const { sendMessageWithTyping } = require('../utils/messageUtils');
const mongoService = require('../services/mongoService');
const { log } = require('../utils/log');
const moment = require('moment-timezone');

async function handleTimeChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const timeOptionIndex = parseInt(messageBody, 10) - 1;

    const serviceName = currentState.data.serviceChosen;
    const chosenDateString = currentState.data.chosenFullDateString;
    const chosenDayName = currentState.data.chosenDayName;
    const dbAvailableTimes = currentState.data.dbAvailableTimes; // Times fetched from DB

    if (!serviceName || !chosenDateString || !chosenDayName || !dbAvailableTimes) {
        log(`Error: Missing data in timeChoiceHandler for user ${userFrom}. State: ${JSON.stringify(currentState.data)}`, 'error');
        await sendMessageWithTyping(client, userFrom, "Desculpe, ocorreu um erro ao processar sua escolha de horário. Por favor, digite 'menu' para recomeçar.", chat);
        stateManager.resetUserState(userFrom);
        return;
    }

    if (timeOptionIndex >= 0 && timeOptionIndex < dbAvailableTimes.length) {
        const chosenTimeStr = dbAvailableTimes[timeOptionIndex]; // e.g., "13:30"
        log(`User ${userFrom} chose time: ${chosenTimeStr} for date ${chosenDateString}`, 'info');

        // Combine the date from dayChoiceHandler with the time from timeChoiceHandler
        const appointmentDateTime = moment.tz(`${chosenDateString} ${chosenTimeStr}`, "YYYY-MM-DD HH:mm", 'America/Sao_Paulo').toDate();

        const appointmentData = {
            nomeCliente: userName,
            numeroContato: userFrom,
            servicoAgendado: serviceName,
            data: appointmentDateTime,
            nomeAtendente: 'gui', // Explicitly set, though schema has default
        };

        try {
            // Double-check slot availability right before booking (basic concurrency check)
            const currentSlotsForChosenTime = await mongoService.getAvailableSlots(
                chosenDateString,
                'gui',
                30 // Assuming 30 min service duration
            );
            
            if (!currentSlotsForChosenTime.includes(chosenTimeStr)) {
                log(`Concurrency issue or slot just taken: User ${userFrom} tried to book ${chosenDateString} ${chosenTimeStr} for ${serviceName}, but it's no longer available.`, 'warn');
                await sendMessageWithTyping(client, userFrom, `Desculpe ${userName}, o horário ${chosenTimeStr} de ${chosenDayName} (${moment(chosenDateString).format('DD/MM/YYYY')}) para ${serviceName} acabou de ser reservado.`, chat);
                
                // Offer to show updated times for the same day or go back
                currentState.step = 'awaiting_day_selection_from_list'; // Go back to day choice which will then fetch fresh times
                delete currentState.data.dbAvailableTimes;
                await sendMessageWithTyping(client, userFrom, "Por favor, tente escolher outro horário ou dia. Digite 'menu' para ver as opções de serviço novamente.", chat);
                currentState.step = 'awaiting_day_choice'; // Go back to listing days
                delete currentState.data.selectableDays;
                delete currentState.data.chosenFullDateString;
                delete currentState.data.chosenDayName;
                delete currentState.data.dbAvailableTimes;
                stateManager.setUserState(userFrom, currentState);
                return;
            }

            await mongoService.createAppointment(appointmentData);
            await sendMessageWithTyping(client, userFrom,
                `Agendamento confirmado para ${serviceName} no dia ${moment(appointmentDateTime).tz('America/Sao_Paulo').format('DD/MM/YYYY')} às ${moment(appointmentDateTime).tz('America/Sao_Paulo').format('HH:mm')} com Gui. Obrigado, ${userName}!`,
                chat
            );
            log(`Appointment created for ${userFrom}: ${JSON.stringify(appointmentData)}`, 'info');
            stateManager.deleteUserState(userFrom); // End of flow
        } catch (error) {
            log(`Error creating appointment for user ${userFrom}: ${error.message} ${error.stack}`, 'error');
            await sendMessageWithTyping(client, userFrom, "Desculpe, não consegui confirmar seu agendamento devido a um erro. Por favor, tente novamente mais tarde ou digite 'menu'.", chat);
            stateManager.resetUserState(userFrom);
        }

    } else {
        log(`User ${userFrom} provided invalid time option: ${messageBody}`, 'warn');
        let replyMessage = "Opção de horário inválida. Por favor, escolha um dos números da lista.\n";
        dbAvailableTimes.forEach((time, index) => {
            replyMessage += `\n${index + 1}. ${time}`;
        });
        await sendMessageWithTyping(client, userFrom, replyMessage, chat);
        // Keep current state (awaiting_time_choice)
    }
}

module.exports = { handleTimeChoice };