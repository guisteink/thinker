const config = require('../../config');
const { log } = require('../../utils');

/**
 * Objeto contendo todos os handlers para opções do menu
 * @param {Object} whatsappService - Instância do serviço WhatsApp
 * @param {Object} deepseekService - Instância do serviço DeepSeek (still needed for other handlers or fallbacks)
 * @param {Object} mongoService - Instância do serviço MongoDB
 */
const createHandlers = (whatsappService, deepseekService, mongoService) => ({
  /**
   * Handle option 1: View schedule
   */
  async handleViewSchedule(msg) {
    log(`Usuário ${msg.from.split('@')[0]} solicitou visualização da agenda`, 'info');
    try {
      const dataAtual = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const nomeAtendentePadrao = config.appInfo.nomePessoa; // Ou um atendente específico
      const appointmentDefaults = mongoService.Appointment.schema.paths.tempoDeAgendamento.defaultValue;
      const duracaoServicoPadrao = typeof appointmentDefaults === 'function' ? appointmentDefaults() : appointmentDefaults || 30;

      const availableSlots = await mongoService.getAvailableSlots(dataAtual, nomeAtendentePadrao, duracaoServicoPadrao);

      let responseMessage = `📅 *Horários disponíveis para hoje (${dataAtual}) com ${nomeAtendentePadrao}*:\n\n`;
      if (availableSlots.length > 0) {
        responseMessage += availableSlots.map(slot => `- ${slot}`).join('\n');
      } else {
        responseMessage += "Desculpe, não há horários disponíveis para hoje com os critérios informados.";
      }
      responseMessage += "\n\nPara ver outros dias ou serviços, por favor, especifique ou digite 'menu'.";
      await whatsappService.sendWithTyping(msg.from, responseMessage);

    } catch (error) {
      log(`Erro ao buscar horários disponíveis no handler: ${error.message}`, 'error');
      await whatsappService.sendWithTyping(msg.from, "Desculpe, não consegui verificar os horários no momento. Tente novamente mais tarde.");
    }
  },

  /**
   * Handle option 2: Create appointment (Rule-based flow)
   */
  async handleCreateAppointment(msg) {
    const userId = msg.from; // msg.from is the full ID like 123@c.us
    log(`Usuário ${userId.split('@')[0]} iniciou agendamento de horário (fluxo guiado)`, 'info');

    // Set initial state for the rule-based appointment flow
    whatsappService.setUserState(userId, {
        currentStep: 'appointment_awaiting_service',
        data: {} // To store collected info like service, date, time, name
    });

    if (!config.appInfo.servicosRealizados || config.appInfo.servicosRealizados.length === 0) {
        await whatsappService.sendWithTyping(msg.from, "Desculpe, não há serviços configurados no momento. Não é possível agendar.");
        whatsappService.clearUserState(userId); 
        return;
    }

    const servicosFormatados = config.appInfo.servicosRealizados
      .map((servico, index) => `${index + 1}. ${servico}`) 
      .join('\n');

    const firstQuestion = `Para agendar, qual serviço você gostaria? Seguem os serviços realizados:\n${servicosFormatados}`;
    
    await whatsappService.sendWithTyping(msg.from, firstQuestion);
  },

  /**
   * Handle option 3: Cancel appointment
   */
  async handleCancelAppointment(msg) {
    log(`Usuário ${msg.from.split('@')[0]} solicitou cancelamento de horário`, 'info');
    await whatsappService.sendWithTyping(
      msg.from, 
      "Para cancelar seu agendamento, por favor informe a data e horário que estava agendado, e se possível, o serviço."
    );
    // Prepara a IA para a próxima mensagem do usuário
    deepseekService.addToConversation(
      msg.from,
      'system',
      'O usuário deseja cancelar um agendamento. A próxima mensagem dele conterá os detalhes. Após receber, confirme o cancelamento (simulado) e pergunte se pode ajudar com mais algo.'
    );
  },

  /**
   * Handle option 4: Change appointment
   */
  async handleChangeAppointment(msg) {
    log(`Usuário ${msg.from.split('@')[0]} solicitou alteração de horário`, 'info');
    await whatsappService.sendWithTyping(
      msg.from, 
      "Para alterar seu agendamento, preciso que me informe:\n\n" +
      "1. Data e horário atual do agendamento\n" +
      "2. Nova data e horário desejados"
    );
    deepseekService.addToConversation(
      msg.from,
      'system',
      'O usuário deseja alterar um agendamento. A próxima mensagem dele conterá os detalhes do agendamento atual e o novo desejado. Após receber, confirme a alteração (simulada) e pergunte se pode ajudar com mais algo.'
    );
  },

  /**
   * Handle option 5: View services
   */
  async handleViewServices(msg) {
    log(`Usuário ${msg.from.split('@')[0]} solicitou lista de serviços`, 'info');
    
    // config.appInfo.servicosRealizados contains normalized names
    const servicosLista = config.appInfo.servicosRealizados.length > 0
      ? config.appInfo.servicosRealizados.map(servico => `- ${servico}`).join('\n')
      : 'Nenhum serviço configurado no momento.';
      
    // The message will refer to option '1' for scheduling as per the renumbered menu
    await whatsappService.sendWithTyping(
      msg.from, 
      `*Serviços Oferecidos*\n\n${servicosLista}\n\nPara agendar um destes serviços, selecione a opção 1 ("Agendar horario") no menu principal.`
    );
  },

  /**
   * Processa a opção selecionada do menu
   */
  async handleMenuOption(option, msg) {
    const senderNumber = msg.from.split('@')[0];
    
    switch (option) {
      case '1': // Now "Agendar horario"
        await this.handleCreateAppointment(msg);
        break;
      case '2': // Now "Cancelar horario"
        await this.handleCancelAppointment(msg);
        break;
      case '3': // Now "Alterar horario"
        await this.handleChangeAppointment(msg);
        break;
      case '4': // Now "Ver serviços oferecidos"
        await this.handleViewServices(msg);
        break;
      default:
        log(`Opção inválida recebida de ${senderNumber}: ${option}`, 'warn');
        await whatsappService.sendWithTyping(msg.from, "Opção inválida. Por favor, escolha uma das opções do menu.");
    }
  }
});

module.exports = createHandlers;