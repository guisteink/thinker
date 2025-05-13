const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');
const moment = require('moment-timezone'); // Ensure moment-timezone is required

async function handleDayChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const chosenDayKey = messageBody;
    const serviceName = currentState.data.serviceChosen;

    if (serviceName &&
        appData.mockAvailability[serviceName] &&
        appData.mockAvailability[serviceName][chosenDayKey]) {

        const dayInfo = appData.mockAvailability[serviceName][chosenDayKey]; // e.g., { day: "segunda", times: [...] }

        // --- Logic to determine the actual date ---
        const dayMap = { "segunda": 1, "terça": 2, "quarta": 3, "quinta": 4, "sexta": 5, "sábado": 6, "domingo": 0 };
        const targetDayOfWeek = dayMap[dayInfo.day.toLowerCase()];

        if (targetDayOfWeek === undefined) {
            log(`Error: Could not map day name ${dayInfo.day} to a day of the week for user ${userFrom}.`, 'error');
            await sendMessageWithTyping(client, userFrom, "Desculpe, houve um erro ao processar o dia. Por favor, tente novamente ou digite 'menu'.", chat);
            stateManager.resetUserState(userFrom); // Or go back a step
            return;
        }

        let chosenDateMoment = moment().tz('America/Sao_Paulo'); // Use your desired timezone
        // Move to the target day of the week.
        // If today is the target day but past typical booking times, or if today is past the target day in the week, advance to next week's target day.
        if (chosenDateMoment.day() > targetDayOfWeek || (chosenDateMoment.day() === targetDayOfWeek && chosenDateMoment.hour() > 18)) { // Heuristic for "past booking time"
            chosenDateMoment.add(1, 'week');
        }
        chosenDateMoment.day(targetDayOfWeek).startOf('day'); // Set to the target day and start of day

        currentState.data.chosenFullDateString = chosenDateMoment.format("YYYY-MM-DD"); // Store as YYYY-MM-DD string
        // --- End of actual date logic ---

        currentState.data.chosenDayKey = chosenDayKey;
        currentState.data.chosenDayName = dayInfo.day;
        currentState.step = 'awaiting_time_choice';
        stateManager.setUserState(userFrom, currentState);
        log(`User ${userFrom} chose day: ${dayInfo.day} (key: ${chosenDayKey}), resolved to date: ${currentState.data.chosenFullDateString} for service ${serviceName}`, 'info');

        if (!dayInfo.times || dayInfo.times.length === 0) {
            await sendMessageWithTyping(client, userFrom, `Desculpe, não há horários disponíveis para ${dayInfo.day} (${currentState.data.chosenFullDateString}) para o serviço ${serviceName}. Por favor, tente outro dia ou serviço.`, chat);
            currentState.step = 'awaiting_day_choice'; // Volta para a escolha do dia
            // Optionally clear chosenFullDateString if going back
            // delete currentState.data.chosenFullDateString;
            stateManager.setUserState(userFrom, currentState);
            return;
        }

        let timeMessage = `Ótimo! Para ${dayInfo.day} (${currentState.data.chosenFullDateString}), temos os seguintes horários disponíveis:\n`;
        dayInfo.times.forEach((time, index) => {
            timeMessage += `\n${index + 1}. ${time}`;
        });
        timeMessage += "\n\nPor favor, digite o número do horário desejado.";
        await sendMessageWithTyping(client, userFrom, timeMessage, chat);

    } else {
        log(`User ${userFrom} provided invalid day key: ${chosenDayKey} for service ${currentState.data.serviceChosen || 'N/A'}`, 'warn');
        await sendMessageWithTyping(client, userFrom,
            "Opção de dia inválida. Por favor, tente novamente ou digite 'menu' para recomeçar.",
            chat);
        // Don't delete user state, let them retry or type menu
        // stateManager.deleteUserState(userFrom);
        // Instead, maybe reset to awaiting_day_choice if service is known
        if (currentState.data.serviceChosen) {
            currentState.step = 'awaiting_day_choice';
            stateManager.setUserState(userFrom, currentState);
            // Resend day options? Or just prompt to try again.
        } else {
            stateManager.resetUserState(userFrom); // If service unknown, reset fully
        }
    }
}

module.exports = { handleDayChoice };