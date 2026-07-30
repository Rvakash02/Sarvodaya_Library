const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client = null;
let qrCodeDataUrl = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR, READY

function initWhatsApp() {
    if (client) {
        console.log('WhatsApp Client already exists. Skipping initialization.');
        return;
    }

    console.log('Initializing WhatsApp Client...');
    connectionStatus = 'CONNECTING';

    const fs = require('fs');
    const userAgentStr = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    let puppeteerOptions = {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-blink-features=AutomationControlled',
            `--user-agent=${userAgentStr}`
        ]
    };

    if (process.platform === 'darwin') {
        const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(localChrome)) {
            console.log('Using local Google Chrome installation at:', localChrome);
            puppeteerOptions.executablePath = localChrome;
        }
    }

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: puppeteerOptions,
        userAgent: userAgentStr
    });

    client.on('qr', async (qr) => {
        console.log('WhatsApp QR Code received.');
        connectionStatus = 'QR';
        try {
            qrCodeDataUrl = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('Failed to generate QR Data URL:', err);
        }
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready and connected!');
        connectionStatus = 'READY';
        qrCodeDataUrl = null;
    });

    client.on('authenticated', () => {
        console.log('WhatsApp authenticated successfully.');
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Auth failure:', msg);
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Client disconnected:', reason);
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        
        // Cleanup old client reference
        client = null;
        
        // Attempt to re-initialize after a delay
        setTimeout(() => {
            initWhatsApp();
        }, 10000);
    });

    client.initialize().catch(err => {
        console.error('Error during WhatsApp client initialization:', err);
        connectionStatus = 'DISCONNECTED';
        client = null;
    });
}

function getWhatsAppStatus() {
    return {
        status: connectionStatus,
        qr: qrCodeDataUrl
    };
}

async function sendWhatsAppMessage(phone, message) {
    if (connectionStatus !== 'READY' || !client) {
        console.warn(`Cannot send WhatsApp message to ${phone}. Client is not ready (Status: ${connectionStatus})`);
        return false;
    }

    try {
        // Strip non-digits from phone number
        let cleanPhone = phone.replace(/\D/g, '');
        
        // If 10 digits, assume Indian country code (+91)
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        const chatId = cleanPhone + '@c.us';
        await client.sendMessage(chatId, message);
        console.log(`WhatsApp message sent successfully to ${chatId}`);
        return true;
    } catch (err) {
        console.error(`Failed to send WhatsApp message to ${phone}:`, err);
        return false;
    }
}

module.exports = {
    initWhatsApp,
    getWhatsAppStatus,
    sendWhatsAppMessage
};
