const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');
const moment = require('moment-timezone');
require('moment/locale/pt-br');
moment.locale('pt-br');

const mongoService = require('../services/mongoService'); // Import mongoService
const { appInfo } = require('../config');

const SERVICE_DURATION_MINUTES = 30; // ou também puxar se for configurável
const ATTENDANT_NAME = appInfo.nomePessoa;

async function handleDayChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const serviceName = currentState.data.serviceChosen;

    if (!serviceName) {
        log(`Error: serviceName not found in currentState for user ${userFrom} in handleDayChoice.`, 'error');
        await sendMessageWithTyping(client, userFrom, "Desculpe, não consegui identificar o serviço. Por favor, comece novamente digitando 'menu'.", chat);
        stateManager.resetUserState(userFrom);
        return;
    }

    // If we are at the stage to present days to the user
    if (currentState.step === 'awaiting_day_choice') {
        const today = moment().tz('America/Sao_Paulo');
        const availableDays = [];
        let key = 1;

        let start, end;
        if (today.day() >= 1 && today.day() <= 4) {
            start = today.clone().add(1, 'day');
            end = today.clone().day(5);
        } else {
            start = today.clone().add(1, 'week').startOf('isoWeek');
            end = start.clone().day(5);
        }

        for (
            let d = start.clone();
            d.isSameOrBefore(end, 'day');
            d.add(1, 'day')
        ) {
            if (d.isoWeekday() <= 5) {
                // strip "-feira"
                const raw = d.format('dddd');
                const day = raw.split('-')[0];
                availableDays.push({
                    key: String(key++),
                    name: day,
                    dateString: d.format('YYYY-MM-DD'),
                    displayFormat: `${day.charAt(0).toUpperCase() + day.slice(1)} (${d.format('DD/MM')})`
                });
            }
        }

        if (availableDays.length === 0) {
            log(`No upcoming working days found based on new logic for ${ATTENDANT_NAME} for service ${serviceName}. User: ${userFrom}`, 'warn');
            await sendMessageWithTyping(client, userFrom, `Desculpe, não há dias disponíveis para ${serviceName} com ${ATTENDANT_NAME}. Por favor, tente mais tarde.`, chat);
            stateManager.resetUserState(userFrom);
            return;
        }

        currentState.data.selectableDays = availableDays;
        currentState.step = 'awaiting_day_selection_from_list';
        stateManager.setUserState(userFrom, currentState);

        let dayMessage = `Ótimo! Para ${serviceName}, temos os seguintes dias disponíveis:\n`;
        availableDays.forEach(day => {
            dayMessage += `\n${day.key}. ${day.name.charAt(0).toUpperCase() + day.name.slice(1)}`;
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

            log(`User ${userFrom} chose day: ${chosenDayObject.name} (${chosenDayObject.dateString}) for service ${serviceName}`, 'info');

            const availableTimes = await mongoService.getAvailableSlots(
                chosenDayObject.dateString,
                ATTENDANT_NAME,
                SERVICE_DURATION_MINUTES
            );

            if (!availableTimes || availableTimes.length === 0) {
                await sendMessageWithTyping(client, userFrom, `Desculpe, não há horários disponíveis para ${chosenDayObject.name} (${moment(chosenDayObject.dateString).format('DD/MM/YYYY')}) para o serviço ${serviceName}. Por favor, tente outro dia.`, chat);
                currentState.step = 'awaiting_day_choice';
                delete currentState.data.selectableDays;
                delete currentState.data.chosenFullDateString;
                delete currentState.data.chosenDayName;
                stateManager.setUserState(userFrom, currentState);
                // To re-trigger day listing, the next message from user will go to 'awaiting_day_choice'
                // Or call handleDayChoice directly:
                // await handleDayChoice(client, msg, chat, userName, userFrom, '', currentState, stateManager, appData);
                return;
            }

            currentState.data.dbAvailableTimes = availableTimes;
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
        }
    } else {
        log(`User ${userFrom} in unexpected step '${currentState.step}' in handleDayChoice. Resetting.`, 'error');
        await sendMessageWithTyping(client, userFrom, "Algo deu errado. Vamos tentar novamente. Digite 'menu'.", chat);
        stateManager.resetUserState(userFrom);
    }
}

module.exports = { handleDayChoice };