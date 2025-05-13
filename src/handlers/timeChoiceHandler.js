const { sendMessageWithTyping } = require('../utils/messageUtils');
const mongoService = require('../services/mongoService'); // Assuming mongoService is exported like this
const { log } = require('../utils/log');
const moment = require('moment-timezone');

async function handleTimeChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const timeOptionIndex = parseInt(messageBody, 10) - 1;

    const serviceName = currentState.data.serviceChosen;
    const dayKey = currentState.data.chosenDayKey;
    const chosenDateString = currentState.data.chosenFullDateString; // e.g., "2025-05-19"

    if (!serviceName || !dayKey || !chosenDateString ||
        !appData.mockAvailability[serviceName] ||
        !appData.mockAvailability[serviceName][dayKey] ||
        !appData.mockAvailability[serviceName][dayKey].times) {
        log(`Error: Missing data in timeChoiceHandler for user ${userFrom}. State: ${JSON.stringify(currentState.data)}`, 'error');
        await sendMessageWithTyping(client, userFrom, "Desculpe, ocorreu um erro ao processar sua escolha de horário. Por favor, digite 'menu' para recomeçar.", chat);
        stateManager.resetUserState(userFrom);
        return;
    }

    const availableTimes = appData.mockAvailability[serviceName][dayKey].times;

    if (timeOptionIndex >= 0 && timeOptionIndex < availableTimes.length) {
        const chosenTimeStr = availableTimes[timeOptionIndex]; // e.g., "13:30"
        log(`User ${userFrom} chose time: ${chosenTimeStr} for date ${chosenDateString}`, 'info');

        const [hours, minutes] = chosenTimeStr.split(':').map(Number);

        // Combine the date from dayChoiceHandler with the time from timeChoiceHandler
        const appointmentDateTime = moment.tz(`${chosenDateString} ${chosenTimeStr}`, "YYYY-MM-DD HH:mm", 'America/Sao_Paulo').toDate(); // Use your timezone

        const appointmentData = {
            nomeCliente: userName, // Consider asking for name confirmation if needed
            numeroContato: userFrom,
            servicoAgendado: serviceName,
            data: appointmentDateTime, // This is the combined Date object
            // clienteRecorrente: false, // Default in schema
        };

        try {
            // Before creating, you might want to double-check if this exact slot was just taken.
            // This simple check doesn't handle concurrency well but is a basic guard.
            const existing = await mongoService.findAppointments({ data: appointmentDateTime, servicoAgendado: serviceName });
            if (existing.length > 0) {
                log(`Concurrency issue or slot taken: User ${userFrom} tried to book ${chosenDateString} ${chosenTimeStr} for ${serviceName}, but it's already booked.`, 'warn');
                await sendMessageWithTyping(client, userFrom, `Desculpe ${userName}, o horário ${chosenTimeStr} de ${currentState.data.chosenDayName} (${chosenDateString}) para ${serviceName} acabou de ser reservado. Por favor, escolha outro horário ou dia. Digite 'menu' para ver as opções novamente.`, chat);
                currentState.step = 'awaiting_time_choice'; // Let them pick another time for the same day
                stateManager.setUserState(userFrom, currentState);
                // Resend time options for that day
                let timeMessage = `Para ${currentState.data.chosenDayName} (${chosenDateString}), os horários ainda disponíveis são:\n`;
                // (You might need to re-fetch available slots here if you want to be super accurate after a conflict)
                availableTimes.forEach((time, index) => {
                    if (time !== chosenTimeStr) { // Simple exclusion, better to re-evaluate available slots
                         timeMessage += `\n${index + 1}. ${time}`;
                    }
                });
                 timeMessage += "\n\nPor favor, digite o número do horário desejado, ou 'menu' para recomeçar.";
                await sendMessageWithTyping(client, userFrom, timeMessage, chat);
                return;
            }


            await mongoService.createAppointment(appointmentData);
            await sendMessageWithTyping(client, userFrom,
                `Agendamento confirmado para ${serviceName} no dia ${moment(appointmentDateTime).tz('America/Sao_Paulo').format('DD/MM/YYYY')} às ${moment(appointmentDateTime).tz('America/Sao_Paulo').format('HH:mm')}. Obrigado, ${userName}!`,
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
        availableTimes.forEach((time, index) => {
            replyMessage += `\n${index + 1}. ${time}`;
        });
        await sendMessageWithTyping(client, userFrom, replyMessage, chat);
        // Keep current state (awaiting_time_choice)
    }
}

module.exports = { handleTimeChoice };