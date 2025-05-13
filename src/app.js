const whatsappService = require('./services/whatsappService');
const messageRouter   = require('./handlers/messageRouter');
const stateManager    = require('./stateManager');
const { appInfo }     = require('./config');
const { log }         = require('./utils/log');

const services = Object.fromEntries(
  appInfo.servicosRealizados.map((svc, idx) => [idx + 1, svc])
);

// Dados adicionais passados ao roteador
const appData = { services, mockAvailability: {} };

async function handleIncomingMessage(client, msg) {
  // Ignora status e mensagens não-humanas
  if (!msg.from.endsWith('@c.us') || msg.isStatus) return;

  const chat    = await msg.getChat();
  const contact = await msg.getContact();
  const userName    = contact.pushname?.split(' ')[0] || 'cliente';
  const userFrom    = msg.from;
  const messageBody = msg.body.trim().toLowerCase();

  log(`Received message from ${userName} (${userFrom}): "${msg.body}"`, 'info');

  await messageRouter.routeMessage(
    client,
    msg,
    chat,
    userName,
    userFrom,
    messageBody,
    stateManager,
    appData
  );
}

async function start() {
  log('Application starting...', 'info');

  try {
    await whatsappService.initializeClient();
    const client = whatsappService.getClient();
    log('WhatsApp client initialized successfully.', 'info');

    whatsappService.onMessage(msg => handleIncomingMessage(client, msg));
    log('Application started. WhatsApp client is listening for messages.', 'info');
  } catch (error) {
    log(`Failed to start application: ${error.message}`, 'error');
    process.exit(1);
  }

  // Captura SIGINT, SIGTERM e SIGQUIT para shutdown gracioso
  ['SIGINT','SIGTERM','SIGQUIT'].forEach(signal =>
    process.on(signal, async () => {
      log(`\n${signal} received, shutting down...`, 'warn');
      await whatsappService.destroyClient();
      log('Application shut down gracefully.', 'info');
      process.exit(0);
    })
  );
}

module.exports = { start };