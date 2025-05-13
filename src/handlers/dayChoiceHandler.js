const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');

async function handleDayChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const chosenDayKey = messageBody; // Ex: "1", "2"
    const serviceName = currentState.data.serviceChosen;

    if (serviceName &&
        appData.mockAvailability[serviceName] &&
        appData.mockAvailability[serviceName][chosenDayKey]) {

        const dayInfo = appData.mockAvailability[serviceName][chosenDayKey]; // { day: "segunda", times: ["13h30", "15h00"] }

        currentState.data.chosenDayKey = chosenDayKey;
        currentState.data.chosenDayName = dayInfo.day; // Salva "segunda", "terça", etc.
        currentState.step = 'awaiting_time_choice';
        stateManager.setUserState(userFrom, currentState);
        log(`User ${userFrom} chose day: ${dayInfo.day} (key: ${chosenDayKey}) for service ${serviceName}`, 'info');

        if (!dayInfo.times || dayInfo.times.length === 0) {
            await sendMessageWithTyping(client, userFrom, `Desculpe, não há horários disponíveis para ${dayInfo.day} para o serviço ${serviceName}. Por favor, tente outro dia ou serviço.`, chat);
            // Opcionalmente, resetar ou voltar um passo
            currentState.step = 'awaiting_day_choice'; // Volta para a escolha do dia
            stateManager.setUserState(userFrom, currentState);
            return;
        }

        let timeMessage = `Ótimo! Para ${dayInfo.day}, temos os seguintes horários disponíveis:\n`;
        dayInfo.times.forEach((time, index) => {
            timeMessage += `\n${index + 1}. ${time}`; // Opções: 1. 13h30, 2. 15h00
        });
        timeMessage += "\n\nPor favor, digite o número do horário desejado.";
        await sendMessageWithTyping(client, userFrom, timeMessage, chat);

    } else {
        log(`User ${userFrom} provided invalid day key: ${chosenDayKey}`, 'warn');
        await sendMessageWithTyping(client, userFrom,
            "Essa não é uma resposta prevista e portanto estou finalizando sua jornada.", 
            chat);
        stateManager.deleteUserState(userFrom);
    }
}

module.exports = { handleDayChoice };