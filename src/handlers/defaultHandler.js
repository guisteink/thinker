const { sendMessageWithTyping } = require('../utils/messageUtils');

async function handleDefault(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    await sendMessageWithTyping(client, userFrom, `Desculpe, não entendi. Digite "oi" ou "menu" para ver as opções.`, chat);
    stateManager.deleteUserState(userFrom);
}

module.exports = { handleDefault };