const setupConfig = require('./src/setup');
const whatsappService = require('./src/services/whatsapp');
const mongoService = require('./src/services/mongoService'); 
const { log } = require('./src/utils');

// Flag para controlar o estado do WhatsApp (pode ser removido se não usado globalmente)
// let whatsappReady = false; 

async function startApp() {
  try {
    log('Inicializando configuração...');
    await setupConfig();

    // MongoDB connection is handled within its service constructor
    log('Serviço MongoDB inicializado.'); // Log that the service module is loaded

    log('WhatsApp client initializing...');
    // Ensure you await the initialization and get the client instance
    const client = await whatsappService.initialize(); 
    
    // Registrar eventos importantes (estes já estão dentro de whatsappService.js,
    // mas se precisar de lógica adicional aqui, pode adicionar)
    // client.on('ready', () => {
    //   // whatsappReady = true; // Se a flag global for necessária
    //   log('WhatsApp client is ready and connected (from index.js)');
    // });
    
    // client.on('disconnected', (reason) => {
    //   // whatsappReady = false; // Se a flag global for necessária
    //   log(`WhatsApp client disconnected (from index.js): ${reason}`, 'warn');
    // });
    
    // Tratamento de encerramento gracioso
    setupGracefulShutdown(client); // Now client should be defined
    
  } catch (error) {
    log(`Startup error: ${error.message}`, 'error');
    log(`Stack: ${error.stack}`, 'error'); // Log stack for more details
    process.exit(1);
  }
}

function setupGracefulShutdown(client) {
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      log(`${signal} received, shutting down gracefully...`);
      
      if (client) { // Check if client exists before trying to destroy
        try {
          await client.destroy();
          log('WhatsApp client closed successfully');
        } catch (err) {
          log(`Error closing WhatsApp client: ${err.message}`, 'error');
        }
      }
      
      // Fechar conexão MongoDB (opcional, Mongoose geralmente lida bem com isso)
      // if (mongoService && typeof mongoService.disconnect === 'function') {
      //   try {
      //     await mongoService.disconnect();
      //     log('MongoDB connection closed successfully.');
      //   } catch (err) {
      //     log(`Error closing MongoDB connection: ${err.message}`, 'error');
      //   }
      // }
      
      process.exit(0);
    });
  });
}

startApp();