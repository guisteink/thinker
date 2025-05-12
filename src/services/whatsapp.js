const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config');
const { format, addDays, parseISO, startOfDay } = require('date-fns'); 
const { ptBR } = require('date-fns/locale');
const { log, delay } = require('../utils'); 
const createHandlers = require('./handlers');
const deepseekServiceInstance = require('./deepseek'); 
const mongoServiceInstance = require('./mongoService');

class WhatsAppService {
  constructor() {
    this.client = new Client(config.whatsapp.clientOptions);
    this.setupEventHandlers();
    this.ownNumber = null;
    this.menuSentToUsers = new Set();
    this.userStates = new Map(); 

    this.handlers = createHandlers(this, deepseekServiceInstance, mongoServiceInstance);
    this.deepseekService = deepseekServiceInstance;
    this.mongoService = mongoServiceInstance;
  }

  // Method to set user state
  setUserState(userId, state) {
    this.userStates.set(userId, state);
    log(`State set for ${userId.split('@')[0]}: ${state.currentStep}`, 'debug');
  }

  // Method to get user state
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  // Method to clear user state
  clearUserState(userId) {
    this.userStates.delete(userId);
    log(`State cleared for ${userId.split('@')[0]}`, 'debug');
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
    if (this.client.info && this.client.info.wid) {
        this.ownNumber = this.client.info.wid.user; 
        log(`Bot inicializado no número: ${this.ownNumber}`);
    } else {
        log('Não foi possível obter o WID do bot no evento ready.', 'warn');
    }
  }

  handleDisconnect(reason) {
    log(`Client was disconnected: ${reason}`, 'warn');
  }

  handleAuthFailure() {
    log('Authentication failed', 'error');
  }
  
  _buildMenuMessage() {
    const servicosLista = config.appInfo.servicosRealizados
      .map(servico => `- ${servico}`)
      .join('\n');
    const servicosParaFooter = config.appInfo.servicosRealizados.join(', ');
    let header = config.menuConfig.header.replace('{nomePessoa}', config.appInfo.nomePessoa);
    const optionsText = Object.entries(config.menuConfig.options)
      .map(([key, value]) => `  ${key}. ${value.replace('{chavePix}', config.appInfo.chavePix).replace('{servicosLista}', servicosLista)}`)
      .join('\n');
    let footer = config.menuConfig.footer.replace('{chavePix}', config.appInfo.chavePix).replace('{servicosRealizados}', servicosParaFooter);
    return "```\n" + `${header}\n\n${config.menuConfig.optionPrefix}\n${optionsText}\n\n${footer}` + "\n```";
  }

  _normalizeServiceName(name) {
    if (typeof name !== 'string') return '';
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  async _handleAppointmentAwaitingService(msg, userState) {
    const userId = msg.from;
    const messageText = msg.body.trim();
    const rawSelectedService = messageText;
    const normalizedUserInputService = this._normalizeServiceName(rawSelectedService);

    const matchedService = config.appInfo.servicosRealizados.find(
      s => s === normalizedUserInputService
    );

    if (matchedService) {
      userState.data.tipoDeServico = matchedService;
      const serviceDuration = this.mongoService.Appointment.schema.paths.tempoDeAgendamento.defaultValue || 30;
      const nomeAtendente = config.appInfo.nomePessoa;
      const today = startOfDay(new Date());
      let weeklySlotsMessage = `Para *${matchedService}*, temos os seguintes horários disponíveis nesta semana (07:00 - 20:00):\n`;
      const presentedSlotsData = [];
      let foundAnySlots = false;

      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(today, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayName = format(currentDate, 'eeee', { locale: ptBR });
        const formattedDateDisplay = format(currentDate, 'dd/MM/yyyy');

        const availableSlotsForDay = await this.mongoService.getAvailableSlots(
          dateStr, nomeAtendente, serviceDuration, "07:00", "20:00"
        );

        if (availableSlotsForDay && availableSlotsForDay.length > 0) {
          foundAnySlots = true;
          weeklySlotsMessage += `\n*${dayName} (${formattedDateDisplay}):*\n`;
          const daySlotsWithOptions = [];
          availableSlotsForDay.slice(0, 3).forEach((slot, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            weeklySlotsMessage += `  ${optionLetter}. ${slot}\n`;
            daySlotsWithOptions.push(slot);
          });
          presentedSlotsData.push({ dayName, date: dateStr, times: daySlotsWithOptions });
        }
      }

      if (foundAnySlots) {
        userState.currentStep = 'appointment_awaiting_slot_choice';
        userState.data.presentedSlots = presentedSlotsData;
        this.setUserState(userId, userState);
        weeklySlotsMessage += "\nDigite o dia e a letra da opção (ex: Segunda A, Terça B) ou 'cancelar'.";
        await this.sendWithTyping(userId, weeklySlotsMessage);
      } else {
        await this.sendWithTyping(userId, `Desculpe, não há horários disponíveis para *${matchedService}* com ${nomeAtendente} nos próximos 7 dias (07:00-20:00). Tente outro serviço ou digite 'menu'.`);
        this.clearUserState(userId);
      }
    } else {
      const displayableServices = config.appInfo.servicosRealizados.join(', ');
      await this.sendWithTyping(userId, `Serviço "${rawSelectedService}" não encontrado. Por favor, escolha um dos serviços listados: ${displayableServices}, ou digite 'cancelar' para sair do agendamento.`);
    }
  }

  async _handleAppointmentAwaitingSlotChoice(msg, userState) {
    const userId = msg.from;
    const userShortId = userId.split('@')[0];
    const messageText = msg.body.trim();
    const choiceInput = messageText;
    const parts = choiceInput.split(/\s+/);
    let selectedDayNameInput = '';
    let selectedOptionLetter = '';

    if (parts.length >= 2) {
      selectedOptionLetter = parts.pop().toUpperCase();
      selectedDayNameInput = parts.join(' ');
    }
    
    let chosenDate = null;
    let chosenTime = null;

    if (selectedOptionLetter.length === 1 && selectedOptionLetter >= 'A' && selectedOptionLetter <= 'C') {
      const optionIndex = selectedOptionLetter.charCodeAt(0) - 65;
      for (const dayData of userState.data.presentedSlots) {
        if (dayData.dayName.toLowerCase().startsWith(selectedDayNameInput.toLowerCase())) {
          if (dayData.times && optionIndex < dayData.times.length) {
            chosenDate = dayData.date;
            chosenTime = dayData.times[optionIndex];
            break;
          }
        }
      }
    }

    if (chosenDate && chosenTime) {
      userState.data.dataAgendamento = chosenDate;
      userState.data.horaInicio = chosenTime;
      const clientName = msg.notifyName || userShortId;
      userState.data.nomeCliente = clientName;

      const appointmentDetails = {
        tipoDeServico: userState.data.tipoDeServico,
        nomeCliente: userState.data.nomeCliente,
        dataAgendamento: userState.data.dataAgendamento,
        horaInicio: userState.data.horaInicio,
        nomeAtendente: config.appInfo.nomePessoa,
        whatsappClientId: userId,
      };
      try {
        const newAppointment = await this.mongoService.createAppointment(appointmentDetails);
        const formattedDate = format(parseISO(newAppointment.dataAgendamento), 'dd/MM/yyyy');
        const dayOfWeek = format(parseISO(newAppointment.dataAgendamento), 'eeee', { locale: ptBR });
        await this.sendWithTyping(userId, `Agendamento concluído para ${newAppointment.nomeCliente}! Serviço: ${newAppointment.tipoDeServico}, Dia: ${dayOfWeek}, ${formattedDate}, Hora: ${newAppointment.horaInicio}. Obrigado! Digite 'menu' para mais opções.`);
        this.clearUserState(userId);
        this.menuSentToUsers.add(userShortId);
      } catch (error) {
        log(`Erro ao criar agendamento final para ${userShortId}: ${error.message}`, 'error');
        if (error.name === 'ValidationError') {
          let validationMessages = "Houve um problema com os dados do agendamento:\n";
          for (const field in error.errors) {
            validationMessages += `- ${error.errors[field].message}\n`;
          }
          await this.sendWithTyping(userId, validationMessages + "Por favor, tente novamente ou digite 'menu'.");
        } else {
          await this.sendWithTyping(userId, "Desculpe, ocorreu um erro ao finalizar seu agendamento. Por favor, tente novamente ou digite 'menu'.");
        }
        this.clearUserState(userId);
      }
    } else {
      let weeklySlotsMessage = `Opção inválida: "${choiceInput}".\nPara *${userState.data.tipoDeServico}*, os horários são:\n`;
      userState.data.presentedSlots.forEach(dayData => {
          const formattedDateDisplay = format(parseISO(dayData.date), 'dd/MM/yyyy');
          weeklySlotsMessage += `\n*${dayData.dayName} (${formattedDateDisplay}):*\n`;
          dayData.times.forEach((slot, index) => {
              const optionLetter = String.fromCharCode(65 + index);
              weeklySlotsMessage += `  ${optionLetter}. ${slot}\n`;
          });
      });
      weeklySlotsMessage += "\nDigite o dia e a letra da opção (ex: Segunda A, Terça B) ou 'cancelar'.";
      await this.sendWithTyping(userId, weeklySlotsMessage);
    }
  }

  async handleMessage(msg) {
    try {
      log(`Received message from ${msg.from} (NotifyName: ${msg.notifyName || 'N/A'}): "${msg.body}"`, 'info');
      if (!msg.from.endsWith('@c.us')) return;
      if (!msg.body || msg.body.trim() === "") {
        log(`Mensagem vazia recebida de ${msg.from.split('@')[0]}, ignorando`, 'info');
        return;
      }

      const userId = msg.from;
      const userShortId = userId.split('@')[0];

      if (this.ownNumber && userShortId === this.ownNumber) {
        log(`Mensagem enviada pelo próprio número: ${userShortId}`);
        return;
      }
      
      const messageText = msg.body.trim();
      const optionKeys = Object.keys(config.menuConfig.options);
      const AI_COMMAND_PREFIX = 'ai:';

      if (['cancelar', 'sair', 'parar', 'menu'].includes(messageText.toLowerCase())) {
        const currentState = this.getUserState(userId);
        if (currentState && currentState.currentStep && currentState.currentStep.startsWith('appointment_')) {
            this.clearUserState(userId);
            if (messageText.toLowerCase() !== 'menu') { // If 'menu', let the dedicated block below handle it
                await this.sendWithTyping(userId, "Agendamento cancelado. Digite 'menu' para ver as opções.");
                this.menuSentToUsers.add(userShortId); 
                return;
            }
        }
      }
      
      const userState = this.getUserState(userId);
      if (userState && userState.currentStep) {
        switch (userState.currentStep) {
          case 'appointment_awaiting_service':
            return await this._handleAppointmentAwaitingService(msg, userState);
          case 'appointment_awaiting_slot_choice':
            return await this._handleAppointmentAwaitingSlotChoice(msg, userState);
          default:
            log(`Unknown user state: ${userState.currentStep} for user ${userShortId}`, 'warn');
            this.clearUserState(userId);
            await this.sendWithTyping(userId, "Algo deu errado com seu processo atual. Voltando ao início. Digite 'menu'.");
            this.menuSentToUsers.add(userShortId);
            return;
        }
      }

      if (messageText.toLowerCase() === 'menu') {
        log(`Usuário ${userShortId} solicitou o menu explicitamente.`, 'info');
        this.clearUserState(userId); 
        const menuMessage = this._buildMenuMessage();
        await this.sendWithTyping(userId, menuMessage);
        this.menuSentToUsers.add(userShortId);
        return;
      }

      if (/^\d+$/.test(messageText) && optionKeys.includes(messageText)) {
        if (!this.menuSentToUsers.has(userShortId) && !this.getUserState(userId)) {
            log(`Usuário ${userShortId} tentou opção de menu (${messageText}) sem ter recebido o menu. Enviando menu primeiro.`, 'info');
            const menuMessage = this._buildMenuMessage();
            await this.sendWithTyping(userId, menuMessage);
            this.menuSentToUsers.add(userShortId);
            return; 
        }
        log(`Usuário ${userShortId} selecionou a opção de menu: ${messageText}`, 'info');
        this.clearUserState(userId); 
        this.menuSentToUsers.add(userShortId); 
        return await this.handlers.handleMenuOption(messageText, msg);
      }
      
      if (messageText.toLowerCase().startsWith(AI_COMMAND_PREFIX)) {
        log(`Usuário ${userShortId} usou comando direto para IA: "${messageText}"`, 'info');
        const query = messageText.substring(AI_COMMAND_PREFIX.length).trim();
        this.clearUserState(userId); 
        this.menuSentToUsers.add(userShortId); 
        return await this.handleAIDirectQuery(userId, query);
      }
      
      if (this.menuSentToUsers.has(userShortId) && this.hasOngoingConversation(userId)) {
        log(`Usuário ${userShortId} tem conversa de IA em andamento. Processando com IA: "${messageText}"`, 'info');
        return await this.handleWithAI(msg);
      }
      
      if (!this.menuSentToUsers.has(userShortId)) {
        log(`Enviando menu pela primeira vez para ${userShortId}`, 'info');
        const menuMessage = this._buildMenuMessage();
        await this.sendWithTyping(userId, menuMessage);
        this.menuSentToUsers.add(userShortId);
        return; 
      }
      
      if (this.menuSentToUsers.has(userShortId) && !this.hasOngoingConversation(userId)) {
          log(`Menu enviado para ${userShortId}. Mensagem "${messageText}" não é comando nem opção. Tentando IA geral.`, 'info');
          return await this.handleWithAI(msg); 
      }

      log(`Menu já enviado para ${userShortId}. Mensagem "${messageText}" não corresponde a uma ação esperada. Ignorando.`, 'info');
      
    } catch (error) {
      log(`Erro ao processar mensagem de ${msg.from.split('@')[0]}: ${error.message}`, 'error');
      log(`Stack: ${error.stack}`, 'error'); 
      try {
        await this.sendWithTyping(msg.from, "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente ou digite 'menu'.");
      } catch (sendError) {
        log(`Erro ao enviar mensagem de erro para ${msg.from.split('@')[0]}: ${sendError.message}`, 'error');
      }
      const userId = msg.from;
      if (this.getUserState(userId)) {
          this.clearUserState(userId);
          log(`State cleared for ${userId.split('@')[0]} due to error.`, 'warn');
      }
    }
  }

  hasOngoingConversation(userId) {
    return this.deepseekService.hasActiveConversation(userId);
  }

  async handleWithAI(msg) {
    const userId = msg.from; // Use full ID for deepseekService
    const userShortId = userId.split('@')[0];
    try {
      const chat = await this.client.getChatById(msg.from);
      await chat.sendStateTyping();
      
      const aiResponse = await this.deepseekService.processMessage(userId, msg.body);
      
      try {
        const potentialJson = JSON.parse(aiResponse);
        if (potentialJson.tipoDeServico && potentialJson.dataAgendamento && potentialJson.horaInicio && potentialJson.nomeCliente) {
            log(`IA retornou dados de agendamento para ${userShortId}: ${JSON.stringify(potentialJson)}`, 'info');
            const appointmentData = {
                tipoDeServico: potentialJson.tipoDeServico,
                nomeCliente: potentialJson.nomeCliente,
                dataAgendamento: potentialJson.dataAgendamento,
                horaInicio: potentialJson.horaInicio,
                nomeAtendente: config.appInfo.nomePessoa, 
                whatsappClientId: msg.from,
            };
            const newAppointment = await this.mongoService.createAppointment(appointmentData);
            await this.sendWithTyping(msg.from, `Ótimo, ${newAppointment.nomeCliente}! Seu agendamento para ${newAppointment.tipoDeServico} no dia ${format(parseISO(newAppointment.dataAgendamento), 'dd/MM/yyyy')} às ${newAppointment.horaInicio} com ${newAppointment.nomeAtendente} foi confirmado! Posso ajudar com mais alguma coisa ou digite 'menu'.`);
            this.deepseekService.clearConversationContext(userId, 'O agendamento foi concluído. A conversa agora é geral. Pergunte se posso ajudar com mais algo ou se deseja ver o menu.');
            return true; 
        }
      } catch (jsonError) {
        // Not a JSON for appointment, send the AI response as is
        log(`Resposta da IA para ${userShortId} não é um JSON de agendamento (ou erro ao parsear): "${aiResponse.substring(0,100)}"`, 'debug');
      }
      
      await this.sendWithTyping(msg.from, aiResponse);
      return true;
    } catch (error) {
      log(`Erro no handleWithAI para ${userShortId}: ${error.message}`, 'error');
      await this.sendWithTyping(msg.from, "Desculpe, tive um problema ao processar sua mensagem com a IA.");
      return false;
    }
  }

  async handleAIDirectQuery(from, query) {
    const userShortId = from.split('@')[0];
    try {
      await this.sendWithTyping(from, "Consultando a IA...");
      // Pass `from` (full userId) to deepseekService
      const aiResponse = await this.deepseekService.processMessage(from, query); 
      await this.sendWithTyping(from, aiResponse);
    } catch (error) {
      log(`Erro no handleAIDirectQuery para ${userShortId}: ${error.message}`, 'error');
      await this.sendWithTyping(from, "Desculpe, tive um problema ao consultar a IA.");
    }
  }

  async sendWithTyping(to, text) {
    try {
      const chat = await this.client.getChatById(to);
      await chat.sendStateTyping();
      await delay(config.delays.typing); 
      await this.client.sendMessage(to, text.trim());
      log(`Sending message to ${to.split('@')[0]}: "${text.substring(0, 50)}..."`, 'info');
    } catch (error) {
      log(`Erro ao enviar mensagem com typing para ${to.split('@')[0]}: ${error.message}`, 'error');
    }
  }

  initialize() {
    return this.client.initialize()
      .catch(err => {
        log(`Erro durante a inicialização do cliente WhatsApp: ${err.message}`, 'error');
        throw err; 
      });
  }
}

module.exports = new WhatsAppService();