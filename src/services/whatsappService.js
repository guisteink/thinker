const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const { log } = require('../utils/log'); // Import log

let clientInstance;

function initializeClient() {
    log('Initializing WhatsApp client...', 'info');
    clientInstance = new Client({
        puppeteer: {
            args: ['--no-sandbox'],
        }
    });

    clientInstance.on('qr', qr => {
        log('QR code received, please scan.', 'info');
        qrcode.generate(qr, { small: true });
    });

    clientInstance.on('ready', () => {
        log('WhatsApp client is ready!', 'info');
    });

    clientInstance.on('disconnected', (reason) => {
        log(`WhatsApp client disconnected: ${reason}`, 'warn');
        // Optional: Add logic for re-initialization attempts
        // if (clientInstance && typeof clientInstance.initialize === 'function') {
        //     log('Attempting to re-initialize client...', 'info');
        //     clientInstance.initialize().catch(err => log(`Error re-initializing client: ${err.message}`, 'error'));
        // }
    });

    clientInstance.on('auth_failure', msg => {
        log(`WhatsApp authentication failure: ${msg}`, 'error');
    });

    clientInstance.on('loading_screen', (percent, message) => {
        log(`WhatsApp loading screen: ${percent}% - ${message}`, 'debug');
    });


    return clientInstance.initialize()
        .then(() => {
            log('Client initialized promise resolved.', 'debug');
        })
        .catch(err => {
            log(`Error initializing WhatsApp client: ${err.message}`, 'error');
            throw err;
        });
}

function getClient() {
    if (!clientInstance) {
        log("Attempted to get client, but it's not initialized.", 'error');
        throw new Error("WhatsApp client not initialized.");
    }
    // log("WhatsApp client instance retrieved.", 'debug');
    return clientInstance;
}

function onMessage(handler) {
    if (!clientInstance) {
        log("Attempted to set message handler, but client not initialized.", 'error');
        throw new Error("WhatsApp client not initialized. Cannot set message handler.");
    }
    log("Setting message handler for WhatsApp client.", 'info');
    clientInstance.on('message', handler);
}

async function destroyClient() {
    log('Attempting to destroy WhatsApp client...', 'info');
    if (clientInstance && typeof clientInstance.destroy === 'function') {
        try {
            await clientInstance.destroy();
            log('WhatsApp client destroyed successfully.', 'info');
        } catch (err) {
            log(`Error destroying WhatsApp client: ${err.message}`, 'error');
        }
    } else {
        log('No client instance to destroy or destroy function unavailable.', 'warn');
    }
}

module.exports = {
    initializeClient,
    getClient,
    onMessage,
    destroyClient
};