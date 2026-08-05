/**
 * whatsapp.js — Hardened WhatsApp Web client
 *
 * Problems solved:
 *  1. SingletonLock / SingletonSocket left by crashed Chrome  → wiped on every init
 *  2. Client crashes with no recovery                         → auto-restart with backoff
 *  3. Infinite restart loop on permanent auth failure         → bail after MAX_RETRIES
 *  4. Double-initialisation on hot-reload                     → guarded by isInitialising flag
 *  5. Missing phone-number edge cases (11-digit 0XX)          → robust normalisation
 *  6. EPERM / cosmiconfig traversal errors                    → puppeteer cacheDir pinned here too
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// ── Config ────────────────────────────────────────────────────────────────────
const AUTH_DATA_PATH    = path.resolve(__dirname, '../.wwebjs_auth');
const SESSION_DIR       = path.join(AUTH_DATA_PATH, 'session');
const LOCK_FILES        = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

const MAX_RETRIES       = 5;   // give up & require manual restart after this many consecutive fails
const BASE_RETRY_MS     = 10_000;  // 10 s initial retry delay
const MAX_RETRY_MS      = 300_000; // 5 min cap

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── State ─────────────────────────────────────────────────────────────────────
let client          = null;
let qrCodeDataUrl   = null;
let status          = 'DISCONNECTED'; // DISCONNECTED | CONNECTING | QR | READY | FAILED
let retryCount      = 0;
let retryTimer      = null;
let isInitialising  = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

const { execSync } = require('child_process');

/** Remove Chrome singleton/lock files & kill orphaned session browsers so a fresh session can start */
function clearLockFiles() {
    try {
        if (process.platform !== 'win32') {
            execSync("pkill -f '\\.wwebjs_auth/session' || true", { stdio: 'ignore' });
        }
    } catch (_) {}

    if (!fs.existsSync(SESSION_DIR)) return;
    const dirsToClean = [SESSION_DIR, path.join(SESSION_DIR, 'Default')];
    const extraLocks = [...LOCK_FILES, 'LOCK', 'DevToolsActivePort'];

    for (const dir of dirsToClean) {
        if (!fs.existsSync(dir)) continue;
        for (const file of extraLocks) {
            const p = path.join(dir, file);
            try {
                if (fs.existsSync(p)) {
                    fs.unlinkSync(p);
                    console.log(`[WhatsApp] Removed stale lock file: ${p}`);
                }
            } catch (e) {
                console.warn(`[WhatsApp] Could not remove lock file ${p}:`, e.message);
            }
        }
    }
}

/** Build puppeteer options depending on the OS */
function buildPuppeteerOptions() {
    const opts = {
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
            '--disable-blink-features=AutomationControlled',
            `--user-agent=${USER_AGENT}`,
        ],
    };

    // Use system Chrome on macOS if available (avoids Puppeteer's bundled Chromium download issues)
    if (process.platform === 'darwin') {
        const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(localChrome)) {
            console.log('[WhatsApp] Using system Google Chrome at:', localChrome);
            opts.executablePath = localChrome;
        }
    }

    return opts;
}

/** Exponential back-off helper (doubles each retry, capped at MAX_RETRY_MS) */
function getRetryDelay() {
    const delay = Math.min(BASE_RETRY_MS * Math.pow(2, retryCount), MAX_RETRY_MS);
    return delay;
}

// ── Core ──────────────────────────────────────────────────────────────────────

function scheduleRestart() {
    if (retryTimer) return; // already scheduled

    if (retryCount >= MAX_RETRIES) {
        console.error(`[WhatsApp] Reached max retries (${MAX_RETRIES}). Service is FAILED. Restart the Node process manually.`);
        status = 'FAILED';
        return;
    }

    const delay = getRetryDelay();
    retryCount++;
    console.log(`[WhatsApp] Scheduling restart attempt ${retryCount}/${MAX_RETRIES} in ${delay / 1000}s...`);

    retryTimer = setTimeout(() => {
        retryTimer = null;
        initWhatsApp();
    }, delay);
}

async function destroyClient() {
    if (!client) return;
    const c = client;
    client = null;
    try {
        await c.destroy();
    } catch (_) {
        // ignore – we're cleaning up
    }
}

function initWhatsApp() {
    if (isInitialising) {
        console.log('[WhatsApp] Already initialising — skipped duplicate call.');
        return;
    }
    if (status === 'FAILED') {
        console.warn('[WhatsApp] Service is in FAILED state. Restart the Node process to try again.');
        return;
    }

    isInitialising  = true;
    status          = 'CONNECTING';
    qrCodeDataUrl   = null;

    // Always clear stale Chrome locks before starting
    clearLockFiles();

    console.log('[WhatsApp] Initialising client...');

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: AUTH_DATA_PATH }),
        puppeteer: buildPuppeteerOptions(),
        userAgent: USER_AGENT,
        // Pin puppeteer cache inside the project to avoid EPERM traversals
        puppeteerOptions: { cacheDirectory: path.resolve(__dirname, '../.wwebjs_cache') },
    });

    // ── Events ────────────────────────────────────────────────────────────────

    client.on('qr', async (qr) => {
        console.log('[WhatsApp] QR received — waiting for scan.');
        status = 'QR';
        try {
            qrCodeDataUrl = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('[WhatsApp] QR generation failed:', err.message);
        }
        isInitialising = false;
    });

    client.on('authenticated', () => {
        console.log('[WhatsApp] Authenticated successfully.');
        retryCount  = 0; // reset backoff on success
        isInitialising = false;
    });

    client.on('ready', () => {
        console.log('[WhatsApp] Client READY — messaging is live.');
        status        = 'READY';
        qrCodeDataUrl = null;
        retryCount    = 0;
        isInitialising = false;
    });

    client.on('auth_failure', async (msg) => {
        console.error('[WhatsApp] Auth failure:', msg);
        status        = 'DISCONNECTED';
        qrCodeDataUrl = null;
        isInitialising = false;
        await destroyClient();
        scheduleRestart();
    });

    client.on('disconnected', async (reason) => {
        console.warn('[WhatsApp] Disconnected:', reason);
        status        = 'DISCONNECTED';
        qrCodeDataUrl = null;
        isInitialising = false;
        await destroyClient();

        // Don't restart on intentional logout
        if (reason === 'LOGOUT') {
            console.log('[WhatsApp] Session logged out. Re-initialising for fresh QR scan...');
            retryCount = 0;
        }
        scheduleRestart();
    });

    // ── Initialize ────────────────────────────────────────────────────────────
    client.initialize().catch(async (err) => {
        console.error('[WhatsApp] initialization error:', err.message);
        status        = 'DISCONNECTED';
        qrCodeDataUrl = null;
        isInitialising = false;
        await destroyClient();
        scheduleRestart();
    });
}

function wipeAuthSession() {
    try {
        if (process.platform !== 'win32') {
            execSync("pkill -f '\\.wwebjs_auth/session' || true", { stdio: 'ignore' });
        }
    } catch (_) {}

    try {
        if (fs.existsSync(AUTH_DATA_PATH)) {
            fs.rmSync(AUTH_DATA_PATH, { recursive: true, force: true });
            console.log('[WhatsApp] Auth session wiped for fresh QR generation.');
        }
    } catch (err) {
        console.warn('[WhatsApp] Could not wipe auth session:', err.message);
    }
}

async function reconnectWhatsApp(forceFresh = false) {
    console.log(`[WhatsApp] Manual reconnect triggered (forceFresh=${forceFresh})...`);

    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    isInitialising = false;
    await destroyClient();

    if (forceFresh) {
        wipeAuthSession();
    } else {
        clearLockFiles();
    }

    status = 'DISCONNECTED';
    retryCount = 0;

    initWhatsApp();
    return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

function getWhatsAppStatus() {
    return { status, qr: qrCodeDataUrl, retryCount };
}

/**
 * Normalise a phone number to WhatsApp's expected format (digits only, with country code).
 * Handles:
 *   10-digit Indian numbers    → prepend 91
 *   11-digit numbers starting 0 → strip leading 0, prepend 91
 *   Already has country code   → use as-is
 */
function normalisePhone(raw) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
    return digits; // assume full international number
}

async function sendWhatsAppMessage(phone, message) {
    if (status !== 'READY' || !client) {
        console.warn(`[WhatsApp] Cannot send to ${phone} — status is ${status}`);
        return false;
    }

    try {
        const chatId = normalisePhone(phone) + '@c.us';
        await client.sendMessage(chatId, message);
        console.log(`[WhatsApp] Message sent to ${chatId}`);
        return true;
    } catch (err) {
        console.error(`[WhatsApp] Send failed to ${phone}:`, err.message);

        // If the client itself errored out, trigger a reconnect
        if (err.message && (err.message.includes('Session closed') || err.message.includes('Target closed'))) {
            console.warn('[WhatsApp] Browser session lost — scheduling reconnect.');
            status = 'DISCONNECTED';
            await destroyClient();
            scheduleRestart();
        }

        return false;
    }
}

module.exports = { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage, reconnectWhatsApp };
