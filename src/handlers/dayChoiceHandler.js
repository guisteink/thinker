const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');
const moment = require('moment-timezone');
const mongoService = require('../services/mongoService'); // Import mongoService

const SERVICE_DURATION_MINUTES = 30; // All appointments are 30 minutes
const ATTENDANT_NAME = 'gui'; // Default attendant

async function handleDayChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const serviceName = currentState.data.serviceChosen;

    if (!serviceName) {
        log(`Error: serviceName not found in currentState for user ${userFrom} in handleDayChoice.`, 'error');
        await sendMessageWithTyping(client, userFrom, "Desculpe, não consegui identificar o serviço. Por favor, comece novamente digitando 'menu'.", chat);
        stateManager.resetUserState(userFrom);
        return;
    }

    // If we don't have a list of days presented to the user yet, generate and show them.
    if (currentState.step === 'awaiting_day_choice') {
        const today = moment().tz('America/Sao_Paulo');
        const availableDays = [];
        let count = 0;
        let currentDay = today.clone();

        // Find the next 5 working days (Mon-Fri) for Gui
        while (count < 5) {
            const dayOfWeek = currentDay.day(); // 0 (Sun) to 6 (Sat)
            // Gui works Mon (1) to Fri (5)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                availableDays.push({
                    key: (count + 1).toString(),
                    name: currentDay.format('dddd').toLowerCase(), // e.g., "segunda-feira" -> "segunda"
                    dateString: currentDay.format('YYYY-MM-DD'),
                    displayFormat: currentDay.format('dddd (DD/MM)') // For user display
                });
                count++;
            }
            currentDay.add(1, 'day');
        }

        if (availableDays.length === 0) {
            log(`No upcoming working days found for ${ATTENDANT_NAME} for service ${serviceName}. User: ${userFrom}`, 'warn');
            await sendMessageWithTyping(client, userFrom, `Desculpe, não há dias disponíveis para agendamento no momento para ${serviceName}. Por favor, tente mais tarde ou fale conosco.`, chat);
            stateManager.resetUserState(userFrom); // Or back to service choice
            return;
        }

        currentState.data.selectableDays = availableDays;
        currentState.step = 'awaiting_day_selection_from_list'; // New step
        stateManager.setUserState(userFrom, currentState);

        let dayMessage = `Ótimo! Para ${serviceName}, temos os seguintes dias disponíveis:\n`;
        availableDays.forEach(day => {
            dayMessage += `\n${day.key}. ${day.name.charAt(0).toUpperCase() + day.name.slice(1)}`; // Capitalize day name
        });
        dayMessage += "\n\nPor favor, digite o número do dia desejado:";
        await sendMessageWithTyping(client, userFrom, dayMessage, chat);
        log(`Presented available days to ${userFrom} for service ${serviceName}. Days: ${JSON.stringify(availableDays.map(d => d.name))}`, 'info');

    } else if (currentState.step === 'awaiting_day_selection_from_list') {
        const chosenDayKey = messageBody;
        const selectableDays = currentState.data.selectableDays;

        if (!selectableDays || selectableDays.length === 0) {
            log(`Error: selectableDays not found in state for ${userFrom} at awaiting_day_selection_from_list.`, 'error');
            await sendMessageWithTyping(client, userFrom, "Ocorreu um erro. Por favor, digite 'menu' para recomeçar.", chat);
            stateManager.resetUserState(userFrom);
            return;
        }

        const chosenDayObject = selectableDays.find(d => d.key === chosenDayKey);

        if (chosenDayObject) {
            currentState.data.chosenFullDateString = chosenDayObject.dateString;
            currentState.data.chosenDayName = chosenDayObject.name;
            // chosenDayKey is already the user's input, can store if needed: currentState.data.chosenDayKey = chosenDayKey;

            log(`User ${userFrom} chose day: ${chosenDayObject.name} (${chosenDayObject.dateString}) for service ${serviceName}`, 'info');

            const availableTimes = await mongoService.getAvailableSlots(
                chosenDayObject.dateString,
                ATTENDANT_NAME,
                SERVICE_DURATION_MINUTES
            );

            if (!availableTimes || availableTimes.length === 0) {
                await sendMessageWithTyping(client, userFrom, `Desculpe, não há horários disponíveis para ${chosenDayObject.name} (${moment(chosenDayObject.dateString).format('DD/MM/YYYY')}) para o serviço ${serviceName}. Por favor, tente outro dia.`, chat);
                // Go back to presenting days
                currentState.step = 'awaiting_day_choice'; // This will re-trigger day listing
                delete currentState.data.selectableDays; // Clear old list
                delete currentState.data.chosenFullDateString;
                delete currentState.data.chosenDayName;
                stateManager.setUserState(userFrom, currentState);
                // Re-call handleDayChoice to show days again
                await handleDayChoice(client, msg, chat, userName, userFrom, '', currentState, stateManager, appData); // Pass empty messageBody
                return;
            }

            currentState.data.dbAvailableTimes = availableTimes; // Store for timeChoiceHandler
            currentState.step = 'awaiting_time_choice';
            stateManager.setUserState(userFrom, currentState);

            let timeMessage = `Ótimo! Para ${chosenDayObject.name} (${moment(chosenDayObject.dateString).format('DD/MM/YYYY')}), temos os seguintes horários disponíveis:\n`;
            availableTimes.forEach((time, index) => {
                timeMessage += `\n${index + 1}. ${time}`;
            });
            timeMessage += "\n\nPor favor, digite o número do horário desejado.";
            await sendMessageWithTyping(client, userFrom, timeMessage, chat);

        } else {
            log(`User ${userFrom} provided invalid day key: ${chosenDayKey} for service ${serviceName}`, 'warn');
            let replyMessage = "Opção de dia inválida. Por favor, escolha um dos números da lista:\n";
            selectableDays.forEach(day => {
                replyMessage += `\n${day.key}. ${day.name.charAt(0).toUpperCase() + day.name.slice(1)}`;
            });
            await sendMessageWithTyping(client, userFrom, replyMessage, chat);
            // Keep current step: 'awaiting_day_selection_from_list'
        }
    } else {
        // Should not happen if routing is correct
        log(`User ${userFrom} in unexpected step '${currentState.step}' in handleDayChoice. Resetting.`, 'error');
        await sendMessageWithTyping(client, userFrom, "Algo deu errado. Vamos tentar novamente. Digite 'menu'.", chat);
        stateManager.resetUserState(userFrom);
    }
}

module.exports = { handleDayChoice };