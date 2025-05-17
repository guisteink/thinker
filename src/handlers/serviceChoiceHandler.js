const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');
const { handleDayChoice } = require('./dayChoiceHandler');

async function handleServiceChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const chosenServiceKey = messageBody;
    const serviceName = appData.services[chosenServiceKey]; // Get service name from appData.services

    if (serviceName) {
        log(`User ${userFrom} is attempting to choose service with key: ${chosenServiceKey} -> ${serviceName}`, 'info');
        currentState.data.serviceChosen = serviceName;
        currentState.data.serviceKeyChosen = chosenServiceKey;
        currentState.step = 'awaiting_day_choice'; // Set state for day choice
        stateManager.setUserState(userFrom, currentState);
        log(`User ${userFrom} chose service: ${serviceName} (key: ${chosenServiceKey}). State set to awaiting_day_choice.`, 'info');

        // Now, directly call handleDayChoice to present the available days to the user.
        // Pass an empty string or null for messageBody as handleDayChoice will initiate day listing.
        // The currentState is already updated.
        try {
            await handleDayChoice(client, msg, chat, userName, userFrom, '', currentState, stateManager, appData);
        } catch (dayChoiceError) {
            log(`Error calling handleDayChoice from handleServiceChoice for user ${userFrom}: ${dayChoiceError.message} ${dayChoiceError.stack}`, 'error');
            await sendMessageWithTyping(client, userFrom, "Ocorreu um erro ao buscar os dias disponíveis. Por favor, tente 'menu' para recomeçar.", chat);
            stateManager.resetUserState(userFrom);
        }

    } else {
        log(`User ${userFrom} provided invalid service key: ${chosenServiceKey}`, 'warn');
        let serviceMessage = "Opção de serviço inválida. Por favor, escolha um dos números abaixo:\n";
        for (const key in appData.services) {
            serviceMessage += `\n${key}. ${appData.services[key]}`;
        }
        await sendMessageWithTyping(client, userFrom, serviceMessage, chat);
        // Keep current state (awaiting_service_choice) for retry
    }
}

module.exports = { handleServiceChoice };