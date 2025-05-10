const config = require('../config');
const { log } = require('../utils');
const deepseekService = require('../services/deepseek');

// Command definitions - each with a matcher and handler
const commands = [
  {
    name: 'aiResponse',
    matcher: msg => msg.body.toLowerCase().startsWith('ai:'),
    handler: async (client, msg) => {
      try {
        // Extract the query (remove the "ai:" prefix)
        const query = msg.body.substring(3).trim();
        
        // Get WhatsApp service
        const whatsappService = require('../services/whatsapp');
        
        // Send "thinking" message
        await whatsappService.sendWithTyping(msg.from, "Estou processando sua pergunta...");
        
        // Get response from DeepSeek with conversation history
        // const aiResponse = await deepseekService.processMessage(msg.from, query);
        
        // Send response back
        // await whatsappService.sendWithTyping(msg.from, aiResponse);
      } catch (error) {
        log(`AI response error: ${error.message}`, 'error');
        
        // Get WhatsApp service
        const whatsappService = require('../services/whatsapp');
        
        // Send error message
        await whatsappService.sendWithTyping(
          msg.from, 
          "Desculpe, tive um problema ao processar sua solicitação."
        );
      }
    }
  },
  // NEW: Default handler for all other messages using AI assistant
  {
    name: 'defaultAIHandler',
    matcher: msg => true, // Match all messages that didn't match previous commands
    handler: async (client, msg) => {
      log('Desativando o tratamento padrão de mensagens com IA', 'info');
      // try {
      //   const whatsappService = require('../services/whatsapp');
        
      //   // Optional: Show typing indicator without sending intermediate message
      //   const chat = await client.getChatById(msg.from);
      //   await chat.sendStateTyping();
        
      //   log(`Processing message with AI assistant for user ${msg.from}`, 'info');
        
      //   // Process message with conversation history
      //   const aiResponse = await deepseekService.processMessage(msg.from, msg.body);
        
      //   // Send response back
      //   await whatsappService.sendWithTyping(msg.from, aiResponse);
      // } catch (error) {
      //   log(`Default AI handler error: ${error.message}`, 'error');
        
      //   const whatsappService = require('../services/whatsapp');
      //   await whatsappService.sendWithTyping(
      //     msg.from, 
      //     "Desculpe, tive um problema ao processar sua mensagem."
      //   );
      // }
    }
  }
];

/**
 * Process a message through all command handlers
 * @param {Client} client - WhatsApp client
 * @param {Message} msg - Message object
 */
async function handleMessage(client, msg) {
  try {
    // Ignore non-private messages or status messages
    if (!msg.from.endsWith('@c.us') || msg.isStatus) {
      log(`Ignoring non-private or status message from: ${msg.from}`, 'debug');
      return;
    }
    
    // Log incoming message
    log(`Received message from ${msg.from}: "${msg.body.substring(0, 50)}${msg.body.length > 50 ? '...' : ''}"`, 'info');
    
    // Store the original sender ID to ensure we're using it consistently
    const originalSender = msg.from;
    log(`Processing for sender ID: ${originalSender}`, 'info');
    
    // Find first matching command
    for (const command of commands) {
      if (command.matcher(msg)) {
        log(`Executing command: ${command.name} for user ${originalSender}`, 'info');
        
        // Execute handler with the original message
        await command.handler(client, msg);
        
        log(`Completed execution for ${originalSender}`, 'info');
        return;
      }
    }
    
    log(`No matching command found for user ${originalSender}`, 'warn');
  } catch (error) {
    log(`Error in command handler for ${msg.from}: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
  }
}

module.exports = handleMessage;