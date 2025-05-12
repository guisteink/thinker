const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config');
const { log, delay } = require('../utils');
const createHandlers = require('./handlers');
const deepseekServiceInstance = require('./deepseek'); 
const mongoServiceInstance = require('./mongoService'); // Importe o mongoService

class WhatsAppService {
  constructor() {
    this.client = new Client(config.whatsapp.clientOptions);
    this.setupEventHandlers();
    this.ownNumber = null; // Vai armazenar o número do bot
    this.menuSentToUsers = new Set(); // NOVO: Para rastrear quem recebeu o menu
    
    // Injete as três dependências
    this.handlers = createHandlers(this, deepseekServiceInstance, mongoServiceInstance);
    this.deepseekService = deepseekServiceInstance; // Armazene se precisar em outros métodos de WhatsAppService
    this.mongoService = mongoServiceInstance; // Armazene se precisar
  }

  setupEventHandlers() {
    this.client.on('qr', this.handleQR);
    this.client.on('ready', this.handleReady.bind(this));
    this.client.on('message', this.handleMessage.bind(this));
    this.client.on('disconnected', this.handleDisconnect);
    this.client.on('auth_failure', this.handleAuthFailure);
  }

  handleQR(qr) {
    log('Scan the QR code below to login:');
    qrcode.generate(qr, { small: true });
  }

  handleReady() {
    log('WhatsApp client is ready!');
    
    // Obtém e armazena o próprio número quando o cliente estiver pronto
    this.client.getWid().then(wid => {
      this.ownNumber = wid.user; // Número sem o @c.us
      log(`Bot inicializado no número: ${this.ownNumber}`);
    });
  }

  handleDisconnect(reason) {
    log(`Client was disconnected: ${reason}`, 'warn');
  }

  handleAuthFailure() {
    log('Authentication failed', 'error');
  }
  
  /**
   * Constrói a mensagem do menu
   * @returns {string} - Mensagem formatada do menu
   */
  _buildMenuMessage() {
    const servicosLista = config.appInfo.servicosRealizados
      .map(servico => `- ${servico}`)
      .join('\n'); // Used for replacing {servicosLista} if it appears in options
    
    // More robust replacement for {servicosRealizados} in the footer
    const servicosParaFooter = config.appInfo.servicosRealizados.join(', ');

    let header = config.menuConfig.header
      .replace('{nomePessoa}', config.appInfo.nomePessoa);
      
    const optionsText = Object.entries(config.menuConfig.options)
      .map(([key, value]) => {
        let optionText = value
          .replace('{chavePix}', config.appInfo.chavePix)
          .replace('{servicosLista}', servicosLista); // If any option uses {servicosLista}
        return `  ${key}. ${optionText}`;
      })
      .join('\n');
    
    let footer = config.menuConfig.footer
      .replace('{chavePix}', config.appInfo.chavePix)
      .replace('{servicosRealizados}', servicosParaFooter); // Correctly replace in footer
      
    return "```\n" + `${header}\n\n${config.menuConfig.optionPrefix}\n${optionsText}\n\n${footer}` + "\n```";
  }

  async handleMessage(msg) {
    try {
      log(`Received message from ${msg.from}: "${msg.body}"`, 'info');
      // Ignore non-private messages
      if (!msg.from.endsWith('@c.us')) return;
      
      // Verifica se a mensagem está vazia
      if (!msg.body || msg.body.trim() === "") {
        const senderId = msg.from.split('@')[0]; // Renomeado para senderId para consistência
        log(`Mensagem vazia recebida de ${senderId}, ignorando`, 'info');
        return; // Não responde a mensagens vazias
      }

      const userId = msg.from.split('@')[0]; // Usar userId para clareza
      // Verifica se a mensagem é do próprio número
      // Adicionado verificação se this.ownNumber já foi definido
      if (this.ownNumber && userId === this.ownNumber) {
        log(`Mensagem enviada pelo próprio número: ${userId}`);
        return; // Não responda às próprias mensagens
      }
      
      const messageText = msg.body.trim();
      const optionKeys = Object.keys(config.menuConfig.options);
      const AI_COMMAND_PREFIX = 'ai:'; // Definindo como constante local para clareza

      // 1. Usuário solicitou o menu explicitamente
      if (messageText.toLowerCase() === 'menu') {
        log(`Usuário ${userId} solicitou o menu explicitamente.`, 'info');
        const menuMessage = this._buildMenuMessage();
        await this.sendWithTyping(msg.from, menuMessage);
        this.menuSentToUsers.add(userId); // Marca que o menu foi (re)enviado
        return;
      }

      // 2. Usuário selecionou uma opção numérica do menu
      if (/^\d+$/.test(messageText) && optionKeys.includes(messageText)) {
        if (!this.menuSentToUsers.has(userId)) {
            log(`Usuário ${userId} tentou opção de menu (${messageText}) sem ter recebido o menu. Enviando menu primeiro.`, 'info');
            const menuMessage = this._buildMenuMessage();
            await this.sendWithTyping(msg.from, menuMessage);
            this.menuSentToUsers.add(userId);
            // O usuário precisará digitar a opção novamente após ver o menu.
            return; 
        }
        log(`Usuário ${userId} selecionou a opção de menu: ${messageText}`, 'info');
        this.menuSentToUsers.add(userId); 
        return await this.handlers.handleMenuOption(messageText, msg);
      }
      
      // 3. Usuário usou um comando direto para IA
      if (messageText.toLowerCase().startsWith(AI_COMMAND_PREFIX)) {
        log(`Usuário ${userId} usou comando direto para IA: "${messageText}"`, 'info');
        const query = messageText.substring(AI_COMMAND_PREFIX.length).trim();
        this.menuSentToUsers.add(userId); 
        return await this.handleAIDirectQuery(msg.from, query);
      }
      
      // 4. Há uma conversa de IA em andamento (e o menu já foi visto/enviado)
      if (this.menuSentToUsers.has(userId) && this.hasOngoingConversation(userId)) {
        log(`Usuário ${userId} tem conversa de IA em andamento. Processando com IA: "${messageText}"`, 'info');
        return await this.handleWithAI(msg); // IA continua a conversa (ex: agendamento)
      }
      
      // 5. Lógica de Envio do Menu Inicial para novo usuário
      if (!this.menuSentToUsers.has(userId)) {
        log(`Enviando menu pela primeira vez para ${userId}`, 'info');
        const menuMessage = this._buildMenuMessage();
        await this.sendWithTyping(msg.from, menuMessage);
        this.menuSentToUsers.add(userId);
        return; 
      }
      
      // Se chegamos aqui, o menu já foi enviado, e a mensagem não é "menu", 
      // nem uma opção numérica válida, nem um comando "ai:", nem uma continuação de conversa IA.
      // O bot deve ficar em silêncio.
      log(`Menu já enviado para ${userId}. Mensagem "${messageText}" não corresponde a uma ação esperada. Ignorando.`, 'info');
      return; // Bot fica em silêncio
      
    } catch (error) {
      const errorUserId = msg && msg.from ? msg.from.split('@')[0] : 'unknown_user';
      log(`Error handling message: ${error.message} for user ${errorUserId}`, 'error');
      log(`Stack: ${error.stack}`, 'error');
      try {
        if (msg && msg.from) { // Garante que msg.from existe
          await this.sendWithTyping(msg.from, "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente ou digite 'menu'.");
        }
      } catch (sendError) {
        log(`Error sending error message to user ${errorUserId}: ${sendError.message}`, 'error');
      }
    }
  }

  /**
   * Verifica se há uma conversa em andamento
   * @param {string} userId - ID do usuário 
   * @returns {boolean} - Verdadeiro se há conversa em andamento
   */
  hasOngoingConversation(userId) {
    // Use a instância injetada
    return this.deepseekService.hasActiveConversation(userId);
  }

  /**
   * Processa uma mensagem usando IA
   * @param {Object} msg - Objeto de mensagem do WhatsApp
   */
  async handleWithAI(msg) {
    const userId = msg.from.split('@')[0];
    try {
      const chat = await this.client.getChatById(msg.from);
      await chat.sendStateTyping();
      
      const aiResponse = await this.deepseekService.processMessage(msg.from, msg.body);
      
      // Tentar detectar se a resposta da IA é um JSON de agendamento
      try {
        const potentialJson = JSON.parse(aiResponse);
        if (potentialJson.tipoDeServico && potentialJson.dataAgendamento && potentialJson.horaInicio && potentialJson.nomeCliente) {
            log(`IA retornou dados de agendamento para ${userId}: ${JSON.stringify(potentialJson)}`, 'info');
            
            const tempoDeAgendamento = potentialJson.tempoDeAgendamento || 30; // Default se não fornecido
            const horaFimCalculada = this.mongoService._minutesToTimeString(
                this.mongoService._timeStringToMinutes(potentialJson.horaInicio) + tempoDeAgendamento
            );

            const appointmentData = {
                tipoDeServico: potentialJson.tipoDeServico,
                nomeCliente: potentialJson.nomeCliente,
                dataAgendamento: potentialJson.dataAgendamento,
                horaInicio: potentialJson.horaInicio,
                nomeAtendente: config.appInfo.nomePessoa,
                tempoDeAgendamento: tempoDeAgendamento,
                horaFim: potentialJson.horaFim || horaFimCalculada,
                valorDoServico: potentialJson.valorDoServico || 50, // Default se não fornecido
                whatsappClientId: msg.from,
                // estaPago e clienteRecorrente podem ser definidos depois ou com mais perguntas
            };

            const newAppointment = await this.mongoService.createAppointment(appointmentData);
            await this.sendWithTyping(msg.from, `Ótimo, ${newAppointment.nomeCliente}! Seu agendamento para ${newAppointment.tipoDeServico} no dia ${newAppointment.dataAgendamento} às ${newAppointment.horaInicio} com ${newAppointment.nomeAtendente} foi confirmado! Posso ajudar com mais alguma coisa ou digite 'menu'.`);
            
            // Limpar contexto de agendamento da conversa da IA para não tentar criar de novo
            this.deepseekService.addToConversation(msg.from, 'system', 'O agendamento foi concluído. A conversa agora é geral. Pergunte se posso ajudar com mais algo ou se deseja ver o menu.');
            return true;
        }
      } catch (jsonError) {
        // Não era um JSON ou não era o JSON esperado, apenas uma resposta normal da IA
        log(`Resposta da IA para ${userId} não é um JSON de agendamento: "${aiResponse.substring(0,100)}"`, 'debug');
      }
      
      await this.sendWithTyping(msg.from, aiResponse);
      return true;
    } catch (error) {
      log(`AI processing error for ${userId}: ${error.message}`, 'error');
      await this.sendWithTyping(msg.from, 
        "Desculpe, não consegui processar sua solicitação no momento. Tente perguntar de forma diferente ou digite 'menu' para ver as opções."
      );
      return false;
    }
  }

  /**
   * Processa uma consulta direta para a IA
   * @param {string} from - ID do destinatário
   * @param {string} query - Consulta para a IA
   */
  async handleAIDirectQuery(from, query) {
    try {
      // Notificar o usuário
      await this.sendWithTyping(from, "Processando sua pergunta...");
      
      // Processar com DeepSeek
      const aiResponse = await this.deepseekService.processMessage(from, query);
      
      // Enviar resposta
      await this.sendWithTyping(from, aiResponse);
      
      return true;
    } catch (error) {
      log(`AI direct query error: ${error.message}`, 'error');
      await this.sendWithTyping(from, 
        "Desculpe, tive um problema ao processar sua consulta. Por favor, tente novamente mais tarde."
      );
      return false;
    }
  }

  /**
   * Send a message with typing indication
   * @param {string} to - Recipient
   * @param {string} text - Message content
   */
  async sendWithTyping(to, text) {
    try {
      // Validate the recipient ID first
      if (!to || typeof to !== 'string' || !to.endsWith('@c.us')) {
        log(`Invalid recipient ID: ${to}`, 'error');
        throw new Error(`Invalid recipient ID: ${to}`);
      }
      
      const chat = await this.client.getChatById(to);
      
      log(`Sending typing indicator to ${to.split('@')[0]}`, 'info');
      await chat.sendStateTyping();
      
      await delay(config.delays.typing);
      
      log(`Sending message to ${to.split('@')[0]}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, 'info');
      return await this.client.sendMessage(to, text);
    } catch (error) {
      log(`Error sending message to ${to}: ${error.message}`, 'error');
      throw error;
    }
  }

  initialize() {
    this.client.initialize();
    return this.client;
  }
}

module.exports = new WhatsAppService();