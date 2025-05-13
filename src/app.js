const { initializeClient, getClient, onMessage, destroyClient } = require('./services/whatsappService');
const { routeMessage } = require('./handlers/messageRouter');
const stateManager = require('./stateManager');
const { appInfo } = require('./config');
const { log } = require('./utils/log');
// p-limit is ESM-only; require it via its default export
const pLimit = require('p-limit').default;

const CONCURRENCY = Number(process.env.CONCURRENCY_LIMIT) || 10;
const limit = pLimit(CONCURRENCY);

// Pré-monta mapa de serviços
const services = Object.fromEntries(
  appInfo.servicosRealizados.map((s, i) => [i+1, s])
);
const appData = { services };

async function handleIncomingMessage(client, msg) {
  if (!msg.from.endsWith('@c.us') || msg.isStatus) return;

  // Garante máximo de HANDLERS simultâneos
  await limit(async () => {
    const chat    = await msg.getChat();
    const contact = await msg.getContact();
    const userName    = contact.pushname?.split(' ')[0] || 'cliente';
    const userFrom    = msg.from;
    const messageBody = msg.body.trim().toLowerCase();

    log(`Received from ${userName} (${userFrom}): "${msg.body}"`, 'info');
    await routeMessage(client, msg, chat, userName, userFrom, messageBody, stateManager, appData);
  });
}

function setupGracefulShutdown() {
  const shutdown = async signal => {
    log(`${signal} received – shutting down...`, 'warn');
    await destroyClient();
    process.exit(0);
  };
  ['SIGINT','SIGTERM','SIGQUIT']
    .forEach(s => process.once(s, () => shutdown(s)));
}

async function start() {
  log('Application starting...', 'info');
  try {
    await initializeClient();
    const client = getClient();
    log('WhatsApp client ready.', 'info');

    onMessage(msg => handleIncomingMessage(client, msg));
    log('Listening for incoming messages.', 'info');
    setupGracefulShutdown();

  } catch (err) {
    log(`Startup failed: ${err.message}`, 'error');
    process.exit(1);
  }
}

module.exports = { start };