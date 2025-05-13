// filepath: c:\Users\guilherme\Desktop\123\src\handlers\messageRouter.js
const { sendMessageWithTyping } = require('../utils/messageUtils');
const {
    handleInitialChoice,
    handleServiceChoice,
    handleDayChoice,    // NOVO
    handleTimeChoice,   // NOVO
    handleDefault
} = require('./index');
const { log } = require('../utils/log');

async function routeMessage(client, msg, chat, userName, userFrom, messageBody, stateManager, appData) {
    log(`msg: ${JSON.stringify(msg)}`, 'info');
    let currentState = stateManager.getUserState(userFrom);
    log(`Routing message for user ${userFrom} in state: ${currentState.step}, message: "${messageBody}"`, 'info');

    const isStandardGreeting = messageBody.match(/^(oi|ol[áa]|come[cç]ar|bom dia|boa tarde|boa noite|ajuda)$/i);
    const isMenuCommand = messageBody === 'menu';
    const isCancelCommand = messageBody === 'cancelar';

    if (isMenuCommand || isCancelCommand) {
        log(`Explicit 'menu' or 'cancelar' command received from ${userFrom}. Resetting state and showing menu.`, 'info');
        currentState = stateManager.resetUserState(userFrom);
        const welcomeMessage = `Olá ${userName}, aqui é o Gui e estou em horário de trabalho.\nO que deseja?\n\n1. Agendar horário\n2. Falar pessoalmente`;
        await sendMessageWithTyping(client, userFrom, welcomeMessage, chat);
        return;
    }

    if (isStandardGreeting) {
        if (currentState.step !== 'awaiting_initial_choice') {
            log(`Standard greeting "${messageBody}" received from ${userFrom}. User not in 'awaiting_initial_choice' (current: ${currentState.step}). Resetting and showing menu.`, 'info');
            currentState = stateManager.resetUserState(userFrom);
            const welcomeMessage = `Olá ${userName}, aqui é o Gui e estou em horário de trabalho.\nO que deseja?\n\n1. Agendar horário\n2. Falar pessoalmente`;
            await sendMessageWithTyping(client, userFrom, welcomeMessage, chat);
            return;
        } else {
            log(`User ${userFrom} sent greeting "${messageBody}" while already in 'awaiting_initial_choice' state. Sending short reminder.`, 'info');
            await sendMessageWithTyping(client, userFrom, "Olá! Por favor, escolha uma opção do menu que enviei, ou digite 'menu' para vê-lo novamente.", chat);
            return;
        }
    }

    const handlerArgs = [client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData];

    try {
        switch (currentState.step) {
            case 'awaiting_initial_choice':
            case 'initial':
                log(`Executing handleInitialChoice for ${userFrom}`, 'debug');
                await handleInitialChoice(...handlerArgs);
                break;
            case 'awaiting_service_choice':
                log(`Executing handleServiceChoice for ${userFrom}`, 'debug');
                await handleServiceChoice(...handlerArgs);
                break;
            case 'awaiting_day_choice': // NOVO ESTADO
                log(`Executing handleDayChoice for ${userFrom}`, 'debug');
                await handleDayChoice(...handlerArgs);
                break;
            case 'awaiting_time_choice': // NOVO ESTADO
                log(`Executing handleTimeChoice for ${userFrom}`, 'debug');
                await handleTimeChoice(...handlerArgs);
                break;
            default:
                log(`Executing handleDefault for ${userFrom} (unknown state: ${currentState.step})`, 'warn');
                await handleDefault(...handlerArgs);
                break;
        }
    } catch (error) {
        log(`Error in handler for state ${currentState.step} for user ${userFrom}: ${error.message} ${error.stack}`, 'error');
        await sendMessageWithTyping(client, userFrom, "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.", chat);
        stateManager.resetUserState(userFrom);
    }
}

module.exports = { routeMessage };