const { sendMessageWithTyping } = require('../utils/messageUtils');
const mongoService = require('../services/mongoService');
const { log } = require('../utils/log');
const moment = require('moment-timezone');

async function handleCancelChoice(
  client, msg, chat, userName, userFrom, messageBody,
  currentState, stateManager, appData
) {
  if (currentState.step === 'awaiting_cancel_choice') {
    const now = new Date();
    const appointments = await mongoService.getAppointmentsForUser(userFrom, now);
    if (!appointments.length) {
      await sendMessageWithTyping(client, userFrom, 'Você não possui agendamentos ativos.', chat);
      stateManager.resetUserState(userFrom);
      return;
    }
    currentState.data.cancelableAppointments = appointments;
    currentState.step = 'awaiting_cancel_selection';
    stateManager.setUserState(userFrom, currentState);
    let msgList = 'Escolha o número do agendamento que deseja cancelar:';
    appointments.forEach((appt, idx) => {
      const dt = moment(appt.data).format('DD/MM/YYYY [às] HH:mm');
      msgList += `\n${idx + 1}. ${appt.servicoAgendado} em ${dt}`;
    });
    await sendMessageWithTyping(client, userFrom, msgList, chat);
  } else if (currentState.step === 'awaiting_cancel_selection') {
    const idx = parseInt(messageBody, 10) - 1;
    const appointments = currentState.data.cancelableAppointments || [];
    if (idx >= 0 && idx < appointments.length) {
      const appt = appointments[idx];
      await mongoService.cancelAppointment(appt._id);
      const dt = moment(appt.data).format('DD/MM/YYYY [às] HH:mm');
      await sendMessageWithTyping(
        client,
        userFrom,
        `Agendamento cancelado: ${appt.servicoAgendado} em ${dt}.`,
        chat
      );
      log(`Appointment ${appt._id} canceled for ${userFrom}`, 'info');
      stateManager.deleteUserState(userFrom);
    } else {
      await sendMessageWithTyping(
        client,
        userFrom,
        'Opção inválida. Digite o número correto do agendamento a ser cancelado.',
        chat
      );
    }
  }
}

module.exports = { handleCancelChoice };
