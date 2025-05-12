const setupConfig = require('./src/setup');
const whatsappService = require('./src/services/whatsapp');
const mongoService = require('./src/services/mongoService'); // Adicione esta linha
const { log } = require('./src/utils');

// Flag para controlar o estado do WhatsApp
let whatsappReady = false;

async function startApp() {
  try {
    // Solicitar configurações do usuário
    log('Inicializando configuração...');
    await setupConfig();

    // A conexão com o MongoDB é iniciada quando mongoService é importado e instanciado.
    // A linha abaixo deve ser removida, pois a conexão já é tentada no construtor de MongoService.
    // log('Serviço MongoDB inicializado e tentando conectar...'); // Log opcional, pode ser mantido se desejar
    // await mongoService.connect(); // REMOVE THIS LINE
    // O log de "MongoDB conectado com sucesso!" virá do próprio MongoService se a conexão for bem-sucedida.
    
    // Inicializar o WhatsApp e aguardar sua conclusão
    log('WhatsApp client initializing...');
    
    // Inicializar whatsapp com tratamento de eventos
    const client = await whatsappService.initialize();
    
    // Registrar eventos importantes
    client.on('ready', () => {
      whatsappReady = true;
      log('WhatsApp client is ready and connected');
    });
    
    client.on('disconnected', () => {
      whatsappReady = false;
      log('WhatsApp client disconnected', 'warn');
      // Implementar estratégia de reconexão se necessário
    });
    
    // Tratamento de encerramento gracioso
    setupGracefulShutdown(client);
    
  } catch (error) {
    log(`Startup error: ${error.message}`, 'error');
    process.exit(1);
  }
}

function setupGracefulShutdown(client) {
  // Capturar sinais de encerramento
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      log(`${signal} received, shutting down gracefully...`);
      
      // Fechar cliente WhatsApp
      try {
        await client.destroy();
        log('WhatsApp client closed successfully');
      } catch (err) {
        log(`Error closing WhatsApp client: ${err.message}`, 'error');
      }
      
      // Sair do processo
      process.exit(0);
    });
  });
}

startApp();