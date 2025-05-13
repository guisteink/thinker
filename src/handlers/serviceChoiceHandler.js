const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');

async function handleServiceChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const chosenServiceKey = messageBody;

    if (appData.services[chosenServiceKey]) {
        currentState.data.serviceChosen = appData.services[chosenServiceKey];
        currentState.data.serviceKeyChosen = chosenServiceKey;
        currentState.step = 'awaiting_day_choice';
        stateManager.setUserState(userFrom, currentState);
        log(`User ${userFrom} chose service: ${currentState.data.serviceChosen} (key: ${chosenServiceKey})`, 'info');

        const serviceAvailability = appData.mockAvailability[currentState.data.serviceChosen];
        if (!serviceAvailability || Object.keys(serviceAvailability).length === 0) {
            await sendMessageWithTyping(client, userFrom, `Desculpe, não temos horários disponíveis para ${currentState.data.serviceChosen} no momento.`, chat);
            await sendMessageWithTyping(client, userFrom, "Digite 'menu' para ver outras opções.", chat);
            stateManager.resetUserState(userFrom);
            return;
        }

        let availabilityMessage = `Ótimo! Para ${currentState.data.serviceChosen}, temos os seguintes dias disponíveis nesta semana:\n`;
        Object.keys(serviceAvailability).forEach(dayKey => {
            const dayInfo = serviceAvailability[dayKey];
            availabilityMessage += `\n${dayKey}. ${dayInfo.day}`;
        });
        availabilityMessage += "\n\nPor favor, digite o número do dia desejado:";
        await sendMessageWithTyping(client, userFrom, availabilityMessage, chat);
    } else {
        log(`User ${userFrom} provided invalid service key: ${chosenServiceKey}`, 'warn');
        let serviceMessage = "Serviço inválido. Por favor, escolha um dos números da lista:\n";
        Object.keys(appData.services).forEach(key => {
            serviceMessage += `\n${key}. ${appData.services[key]}`;
        });
        await sendMessageWithTyping(client, userFrom, serviceMessage, chat);
    }
}

module.exports = { handleServiceChoice };