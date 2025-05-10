const config = require('../../config');
const { log } = require('../../utils');

/**
 * Objeto contendo todos os handlers para opções do menu
 * @param {Object} whatsappService - Instância do serviço WhatsApp
 * @param {Object} deepseekService - Instância do serviço DeepSeek
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
      const duracaoServicoPadrao = 30; // minutos

      const availableSlots = await mongoService.getAvailableSlots(dataAtual, nomeAtendentePadrao, duracaoServicoPadrao);

      let responseMessage = `📅 *Horários disponíveis para hoje (${dataAtual}) com ${nomeAtendentePadrao}*:\n\n`;
      if (availableSlots.length > 0) {
        responseMessage += availableSlots.map(slot => `- ${slot}`).join('\n');
      } else {
        responseMessage += "Desculpe, não há horários disponíveis para hoje com os critérios informados.";
      }
      responseMessage += "\n\nPara ver outros dias ou serviços, por favor, especifique.";
      await whatsappService.sendWithTyping(msg.from, responseMessage);

    } catch (error) {
      log(`Erro ao buscar horários disponíveis no handler: ${error.message}`, 'error');
      await whatsappService.sendWithTyping(msg.from, "Desculpe, não consegui verificar os horários no momento. Tente novamente mais tarde.");
    }
  },

  /**
   * Handle option 2: Create appointment
   */
  async handleCreateAppointment(msg) {
    const userId = msg.from.split('@')[0];
    log(`Usuário ${userId} iniciou agendamento de horário`, 'info');
    
    // Contexto para a IA
    deepseekService.addToConversation(
      msg.from, 
      'system', 
      `O usuário deseja agendar um horário. Colete as seguintes informações: tipo de serviço, data (YYYY-MM-DD), hora de início (HH:MM), nome do cliente. O nome do atendente será ${config.appInfo.nomePessoa}. Após coletar, você me fornecerá um JSON com esses dados para eu salvar. Exemplo de JSON: {"tipoDeServico": "Corte Masculino", "dataAgendamento": "2025-05-15", "horaInicio": "14:30", "nomeCliente": "Carlos Silva"}. Pergunte uma coisa de cada vez.`
    );
    
    const initialPrompt = "Olá! Para agendar, qual serviço você gostaria?";
    const response = await deepseekService.processMessage(msg.from, initialPrompt);
    await whatsappService.sendWithTyping(msg.from, response);
    // A IA continuará a conversa. Em algum momento, a IA deve retornar um JSON.
    // Você precisará de uma lógica no handleWithAI (em whatsapp.js) para detectar esse JSON
    // e então chamar mongoService.createAppointment.
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
    // A próxima mensagem do usuário será pega pelo handleWithAI em whatsapp.js
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
    // Se for usar IA para esta jornada, adicione um system prompt similar aos outros.
    // Por enquanto, apenas envia a mensagem informativa.
    // Para MVP, pode ser suficiente, ou pode-se adicionar um system prompt para a IA:
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
    
    const servicosLista = config.appInfo.servicosRealizados
      .map(servico => `- ${servico}`)
      .join('\n');
      
    await whatsappService.sendWithTyping(
      msg.from, 
      `*Serviços Oferecidos*\n\n${servicosLista}\n\nPara agendar um destes serviços, selecione a opção 2 no menu principal.`
    );
  },

  /**
   * Processa a opção selecionada do menu
   */
  async handleMenuOption(option, msg) {
    const senderNumber = msg.from.split('@')[0];
    
    switch (option) {
      case '1':
        await this.handleViewSchedule(msg);
        break;
      case '2':
        await this.handleCreateAppointment(msg);
        break;
      case '3':
        await this.handleCancelAppointment(msg);
        break;
      case '4':
        await this.handleChangeAppointment(msg);
        break;
      case '5':
        await this.handleViewServices(msg);
        break;
      default:
        log(`Opção inválida recebida de ${senderNumber}: ${option}`, 'warn');
        await whatsappService.sendWithTyping(msg.from, "Opção inválida. Por favor, escolha uma das opções do menu.");
    }
  }
});

module.exports = createHandlers;