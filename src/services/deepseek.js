const axios = require('axios');
const { log } = require('../utils');

/**
 * Service to handle interactions with DeepSeek API with conversation history
 */
class DeepSeekService {
  constructor(config) {
    this.apiKey = config.deepseek.apiKey;
    this.baseUrl = config.deepseek.baseUrl || 'https://api.deepseek.com/v1';
    this.model = config.deepseek.model || 'deepseek-chat';
    this.maxTokens = config.deepseek.maxTokens || 1000;
    this.temperature = config.deepseek.temperature || 0.7;
    
    // Store conversation histories by user ID
    this.conversations = new Map();
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    log('DeepSeek service initialized with conversation tracking', 'info');
  }

  /**
   * Get or create a conversation for a user
   * @param {string} userId - User identifier
   * @returns {Array} - The conversation history
   */
  getConversation(userId) {
    if (!this.conversations.has(userId)) {
      log(`Creating new conversation for user: ${userId}`, 'info');
      this.conversations.set(userId, [
        { 
          role: 'system', 
          content: `Você é um assistente virtual para ${config.appInfo.nomePessoa}.
                   Seu objetivo é conversar naturalmente com os clientes e ajudá-los com:
                   1. Agendamentos - Ver, criar, cancelar ou alterar horários na agenda
                   2. Informações sobre serviços - ${config.appInfo.servicosRealizados.join(', ')}
                   3. Informações sobre pagamentos - A chave PIX é ${config.appInfo.chavePix}
                   
                   Seja amigável, direto e profissional. Para agendamentos, colete:
                   - Qual serviço o cliente deseja
                   - Data e horário de preferência
                   - Nome do cliente
                   
                   Se não souber responder algo, sugira que o cliente selecione uma das opções do menu principal.`
        }
      ]);
    }
    return this.conversations.get(userId);
  }

  /**
   * Verifica se um usuário tem uma conversa ativa
   * @param {string} userId - ID do usuário
   * @returns {boolean} - Verdadeiro se há conversa ativa
   */
  hasActiveConversation(userId) {
    return this.conversations.has(userId) && 
           this.conversations.get(userId).length > 1;
  }

  /**
   * Add a message to a conversation and maintain history size
   * @param {string} userId - User identifier
   * @param {string} role - Message role (user/assistant)
   * @param {string} content - Message content
   */
  addToConversation(userId, role, content) {
    const conversation = this.getConversation(userId);
    conversation.push({ role, content });
    
    // Keep conversation history manageable (prevent token limits)
    if (conversation.length > 12) {
      // Remove oldest messages but keep system prompt
      const systemPrompt = conversation[0];
      conversation.splice(1, 2); // Remove oldest user+assistant exchange
      log(`Trimmed conversation history for user: ${userId}`, 'info');
    }
  }

  /**
   * Process a message with conversation history
   * @param {string} userId - User identifier
   * @param {string} message - User message
   * @returns {Promise<string>} - AI response
   */
  async processMessage(userId, message) {
    try {
      // Add user message to conversation
      this.addToConversation(userId, 'user', message);
      
      const conversation = this.getConversation(userId);
      log(`Processing message for ${userId}. Conversation length: ${conversation.length}`, 'info');
      
      // Ensure we're using the correct userId for the response
      const response = await this.httpClient.post('/chat/completions', {
        model: this.model,
        messages: conversation,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const aiMessage = response.data.choices[0].message.content.trim();
        
        // Store this response with the correct userId
        this.addToConversation(userId, 'assistant', aiMessage);
        
        // Log this successful exchange
        log(`Successfully processed message for ${userId}`, 'info');
        
        return aiMessage;
      } else {
        throw new Error(`Invalid response format from DeepSeek API for user ${userId}`);
      }
    } catch (error) {
      log(`DeepSeek API Error for user ${userId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async generateCompletion(prompt) {
    // Generate random user ID for one-off completions
    const randomId = `legacy-${Math.random().toString(36).substring(2, 10)}`;
    return this.processMessage(randomId, prompt);
  }
}

// Export singleton instance
module.exports = new DeepSeekService(require('../config'));