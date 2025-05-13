const { log } = require('./log'); // Import log

const delay = ms => new Promise(res => setTimeout(res, ms));

async function sendMessageWithTyping(client, chatId, text, chatInstance) {
    if (!client) {
        log("Client not provided to sendMessageWithTyping", 'error');
        return;
    }
    try {
        if (chatInstance && typeof chatInstance.sendStateTyping === 'function') {
            await chatInstance.sendStateTyping();
        }
        await delay(1500); // Simulate typing
        await client.sendMessage(chatId, text);
        log(`Message sent to ${chatId}: "${text.substring(0,50)}..."`, 'info');
        await delay(1000); // Small pause after message
        if (chatInstance && typeof chatInstance.clearState === 'function') {
            await chatInstance.clearState();
        }
    } catch (error) {
        log(`Error sending message to ${chatId}: ${error.message}`, 'error');
    }
}

module.exports = {
    delay,
    sendMessageWithTyping
};