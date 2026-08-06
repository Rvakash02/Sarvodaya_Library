/**
 * WhatsApp Web Service — Fresh rewrite
 *
 * Manages the WhatsApp Web client lifecycle:
 *   - Initializes headless Chrome via Puppeteer
 *   - Generates QR codes for phone linking
 *   - Sends messages to WhatsApp numbers
 *   - Auto-recovers from crashes with exponential backoff
 *   - Uses LOCAL cached web versions (no remote URL dependency)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const { execSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const AUTH_DIR = path.resolve(__dirname, '../.wwebjs_auth');
const SESSION_DIR = path.join(AUTH_DIR, 'session');
const CACHE_DIR = path.resolve(__dirname, '../.wwebjs_cache');

// ─── Retry config ────────────────────────────────────────────────────────────
const MAX_RETRIES = 5;
const INITIAL_DELAY = 10_000;   // 10s
const MAX_DELAY = 300_000;      // 5min

// ─── Runtime state ───────────────────────────────────────────────────────────
let client = null;
let qrDataUrl = null;
let status = 'DISCONNECTED';    // DISCONNECTED | CONNECTING | QR | READY | FAILED
let retryCount = 0;
let retryTimer = null;
let busy = false;               // prevents double-init


// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find the newest locally-cached WhatsApp Web version.
 * Files in .wwebjs_cache/ are named like "2.3000.1044539926.html".
 * Returns the version string (without .html), or null.
 */
function findLatestLocalVersion() {
    try {
        if (!fs.existsSync(CACHE_DIR)) return null;

        const htmlFiles = fs.readdirSync(CACHE_DIR)
            .filter(f => f.endsWith('.html') && /^\d+\.\d+\.\d+/.test(f));

        if (htmlFiles.length === 0) return null;

        // Sort by version segments (numeric compare)
        htmlFiles.sort((a, b) => {
            const pa = a.replace('.html', '').split('.').map(Number);
            const pb = b.replace('.html', '').split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const diff = (pa[i] || 0) - (pb[i] || 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });

        const latest = htmlFiles[htmlFiles.length - 1].replace('.html', '');
        return latest;
    } catch {
        return null;
    }
}

/**
 * Kill any leftover Chrome processes from previous wwebjs sessions
 * and remove stale Singleton/lock files so Chrome can start fresh.
 */
function cleanupStaleChrome() {
    // Kill orphaned Chrome processes tied to wwebjs
    if (process.platform !== 'win32') {
        try { execSync("pkill -f '\\.wwebjs_auth/session' 2>/dev/null || true", { stdio: 'ignore' }); } catch {}
    }

    // Remove lock files that prevent Chrome from starting
    const lockNames = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'LOCK', 'DevToolsActivePort'];
    const dirs = [SESSION_DIR, path.join(SESSION_DIR, 'Default')];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const name of lockNames) {
            const filePath = path.join(dir, name);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[WA] Cleaned lock: ${name}`);
                }
            } catch {}
        }
    }
}

/**
 * Wipe the entire auth session directory for a completely fresh start.
 * Also kills any lingering Chrome processes.
 */
function wipeSession() {
    if (process.platform !== 'win32') {
        try { execSync("pkill -f '\\.wwebjs_auth' 2>/dev/null || true", { stdio: 'ignore' }); } catch {}
    }
    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            console.log('[WA] Auth session wiped for fresh QR.');
        }
    } catch (e) {
        console.warn('[WA] Could not wipe session:', e.message);
    }
}

/**
 * Build Puppeteer launch options with cross-platform Chrome/Chromium auto-detection
 * (macOS, Render Linux, Docker, Ubuntu, Heroku).
 */
function getPuppeteerArgs() {
    const args = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--no-first-run',
            '--no-zygote',
            '--disable-accelerated-2d-canvas',
            '--disable-blink-features=AutomationControlled',
        ],
    };

    // 1. Check environment variables first (e.g. Render PUPPETEER_EXECUTABLE_PATH or CHROME_BIN)
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        args.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log(`[WA] Using env PUPPETEER_EXECUTABLE_PATH: ${args.executablePath}`);
        return args;
    }

    if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
        args.executablePath = process.env.CHROME_BIN;
        console.log(`[WA] Using env CHROME_BIN: ${args.executablePath}`);
        return args;
    }

    // 2. macOS System Chrome check (preferred on macOS)
    if (process.platform === 'darwin') {
        const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(macChrome)) {
            args.executablePath = macChrome;
            console.log(`[WA] Using macOS system Chrome: ${macChrome}`);
            return args;
        }
    }

    // 3. Check Puppeteer downloaded Chromium binary (Render / Cloud Linux)
    try {
        const pPath = puppeteer.executablePath();
        if (pPath && fs.existsSync(pPath)) {
            args.executablePath = pPath;
            console.log(`[WA] Using Puppeteer downloaded binary: ${pPath}`);
            return args;
        }
    } catch (e) {
        console.warn('[WA] Could not resolve puppeteer.executablePath():', e.message);
    }

    // 4. Linux Cloud (Render / Ubuntu / Debian) system Chromium paths
    if (process.platform === 'linux') {
        const linuxPaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ];
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) {
                args.executablePath = p;
                console.log(`[WA] Using Linux binary: ${p}`);
                return args;
            }
        }
    }

    return args;
}

/** Calculate retry delay with exponential backoff */
function retryDelay() {
    return Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY);
}


// ═══════════════════════════════════════════════════════════════════════════════
// CORE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely destroy the current client and null it out.
 */
async function killClient() {
    if (!client) return;
    const ref = client;
    client = null;
    try {
        await ref.destroy();
    } catch {
        // ignore — we're cleaning up
    }
}

/**
 * Schedule a restart with exponential backoff.
 * Gives up after MAX_RETRIES.
 */
function scheduleRestart() {
    if (retryTimer) return;

    if (retryCount >= MAX_RETRIES) {
        console.error(`[WA] Max retries (${MAX_RETRIES}) reached. Service FAILED. Restart Node process manually.`);
        status = 'FAILED';
        return;
    }

    const delay = retryDelay();
    retryCount++;
    console.log(`[WA] Retry ${retryCount}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s...`);

    retryTimer = setTimeout(() => {
        retryTimer = null;
        initWhatsApp();
    }, delay);
}

/**
 * Initialize the WhatsApp client.
 * This is the main entry point — called on app start and on retries.
 */
function initWhatsApp(force = false) {
    if (busy && !force) {
        console.log('[WA] Already initializing — skipping duplicate call.');
        return;
    }

    busy = true;
    status = 'CONNECTING';
    qrDataUrl = null;

    // Clean up before starting
    cleanupStaleChrome();

    console.log('[WA] Starting client...');

    // Build client options
    const opts = {
        authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
        puppeteer: getPuppeteerArgs(),
        puppeteerOptions: { cacheDirectory: CACHE_DIR },
    };

    // Use local web version cache (no remote URL that can 404)
    const version = findLatestLocalVersion();
    if (version) {
        console.log(`[WA] Using local web version: ${version}`);
        opts.webVersion = version;
        opts.webVersionCache = { type: 'local', path: CACHE_DIR };
    } else {
        console.log('[WA] No local cache — using library default.');
    }

    client = new Client(opts);

    // ── Event handlers ─────────────────────────────────────────────────────

    client.on('qr', async (qr) => {
        console.log('[WA] QR code received.');
        status = 'QR';
        busy = false;
        try {
            qrDataUrl = await qrcode.toDataURL(qr);
            console.log('[WA] QR data URL ready (' + qrDataUrl.length + ' chars).');
        } catch (err) {
            console.error('[WA] QR image generation error:', err.message);
            qrDataUrl = null;
        }
    });

    client.on('authenticated', () => {
        console.log('[WA] Authenticated.');
        retryCount = 0;
        busy = false;
    });

    client.on('ready', () => {
        console.log('[WA] READY — messaging is live.');
        status = 'READY';
        qrDataUrl = null;
        retryCount = 0;
        busy = false;
    });

    client.on('auth_failure', async (msg) => {
        console.error('[WA] Auth failure:', msg);
        status = 'DISCONNECTED';
        qrDataUrl = null;
        busy = false;
        await killClient();
        wipeSession();
        scheduleRestart();
    });

    client.on('disconnected', async (reason) => {
        console.warn('[WA] Disconnected:', reason);
        status = 'DISCONNECTED';
        qrDataUrl = null;
        busy = false;
        await killClient();

        if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
            wipeSession();
            retryCount = 0;
        }
        scheduleRestart();
    });

    // ── Kick off initialization ────────────────────────────────────────────

    client.initialize().catch(async (err) => {
        console.error('[WA] Init error:', err.message);
        status = 'DISCONNECTED';
        qrDataUrl = null;
        busy = false;
        await killClient();
        wipeSession();
        scheduleRestart();
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API  (consumed by routes & scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current service status + QR data URL.
 */
function getWhatsAppStatus() {
    return {
        status,
        qr: qrDataUrl,
        retryCount,
    };
}

/**
 * Normalize an Indian phone number to WhatsApp chat ID format.
 *   10 digits         → prepend 91
 *   11 digits (0...)  → strip 0, prepend 91
 *   anything else     → assume full international
 */
function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
    return digits;
}

/**
 * Send a WhatsApp message. Returns true on success, false on failure.
 */
async function sendWhatsAppMessage(phone, message) {
    if (status !== 'READY' || !client) {
        console.warn(`[WA] Can't send — status is ${status}`);
        return false;
    }

    try {
        const chatId = normalizePhone(phone) + '@c.us';
        await client.sendMessage(chatId, message);
        console.log(`[WA] Sent to ${chatId}`);
        return true;
    } catch (err) {
        console.error(`[WA] Send failed (${phone}):`, err.message);

        // If browser session is dead, trigger auto-recovery
        if (err.message?.includes('Session closed') || err.message?.includes('Target closed')) {
            console.warn('[WA] Browser session lost — reconnecting...');
            status = 'DISCONNECTED';
            await killClient();
            scheduleRestart();
        }

        return false;
    }
}

/**
 * Manual reconnect (called from dashboard).
 * Destroys current client, wipes session if forceFresh, re-initializes.
 */
async function reconnectWhatsApp(forceFresh = true) {
    console.log(`[WA] Manual reconnect (fresh=${forceFresh})...`);

    // Cancel any pending retry
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    busy = false;
    status = 'CONNECTING';
    retryCount = 0;
    qrDataUrl = null;

    await killClient();

    if (forceFresh) {
        wipeSession();
    } else {
        cleanupStaleChrome();
    }

    initWhatsApp(true);
    return true;
}


module.exports = {
    initWhatsApp,
    getWhatsAppStatus,
    sendWhatsAppMessage,
    reconnectWhatsApp,
};
