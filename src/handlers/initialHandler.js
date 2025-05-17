const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log'); 
const { appInfo } = require('../config');
const { handleCancelChoice } = require('./cancelHandler');

async function handleInitialChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    log(`handleInitialChoice: User ${userFrom} chose "${messageBody}"`, 'info');
    if (messageBody === '1') {
        // Agendar
        currentState.step = 'awaiting_service_choice';
        stateManager.setUserState(userFrom, currentState);
        let serviceMessage = "Para agendar, digite o número abaixo. Qual serviço você gostaria? Seguem os serviços realizados:\n";
        for (const key in appData.services) { 
            serviceMessage += `\n${key}. ${appData.services[key]}`;
        }
        await sendMessageWithTyping(client, userFrom, serviceMessage, chat);
        log(`handleInitialChoice: User ${userFrom} proceeds to service choice.`, 'debug');
    } else if (messageBody === '2') {
        // Cancelar agendamento
        currentState.step = 'awaiting_cancel_choice';
        stateManager.setUserState(userFrom, currentState);
        await handleCancelChoice(client, msg, chat, userName, userFrom, '', currentState, stateManager, appData);
    } else if (messageBody === '3') {
        // Alterar horário (não implementado)
        await sendMessageWithTyping(client, userFrom, 'Funcionalidade de alteração de horário em breve disponível.', chat);
        stateManager.deleteUserState(userFrom);
    } else if (messageBody === '4') {
        // Falar pessoalmente
        await sendMessageWithTyping(client, userFrom, 'Entendido. Para falar pessoalmente, por favor, aguarde. Em breve um de nossos atendentes entrará em contato.', chat);
        stateManager.deleteUserState(userFrom);
    } else {
        log(`handleInitialChoice: User ${userFrom} provided invalid initial option "${messageBody}".`, 'warn');
        const welcomeMessage = `Opção inválida. Olá ${userName}, aqui é o ${appInfo.nomePessoa} e estou em horário de trabalho.
O que deseja?

1. Agendar horário (aqui você verá meus horários disponíveis)
2. Cancelar horário
3. Alterar horário
4. Falar pessoalmente`;
        await sendMessageWithTyping(client, userFrom, welcomeMessage, chat);
        currentState.step = 'awaiting_initial_choice';
        stateManager.setUserState(userFrom, currentState);
    }
}

module.exports = { handleInitialChoice };