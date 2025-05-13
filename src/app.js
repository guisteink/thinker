const whatsappService = require('./services/whatsappService');
const messageRouter = require('./handlers/messageRouter');
const stateManager = require('./stateManager');
const { services, mockAvailability } = require('./config/mockData');
const { log } = require('./utils/log'); // Import log

async function start() {
    log('Application starting...', 'info');
    try {
        await whatsappService.initializeClient();
        log('WhatsApp client initialized successfully.', 'info');

        whatsappService.onMessage(async (msg) => {
            if (!msg.from.endsWith('@c.us') || msg.isStatus) {
                // log(`Ignoring status message or group message from: ${msg.from}`, 'debug'); // Optional: for very verbose logging
                return;
            }

            const chat = await msg.getChat();
            const contact = await msg.getContact();
            const userName = contact.pushname ? contact.pushname.split(" ")[0] : "cliente";
            const userFrom = msg.from;
            const messageBody = msg.body.trim().toLowerCase();

            log(`Received message from ${userName} (${userFrom}): "${msg.body}"`, 'info');

            await messageRouter.routeMessage(
                whatsappService.getClient(),
                msg,
                chat,
                userName,
                userFrom,
                messageBody,
                stateManager,
                { services, mockAvailability }
            );
        });

        log('Application started. WhatsApp client is listening for messages.', 'info');

    } catch (error) {
        log(`Failed to start application: ${error.message}`, 'error');
        process.exit(1); // Exit if critical initialization fails
    }

    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach(signal => {
        process.on(signal, async () => {
            log(`\n${signal} received, shutting down...`, 'warn');
            await whatsappService.destroyClient();
            log('Application shut down gracefully.', 'info');
            process.exit(0);
        });
    });
}

module.exports = { start };