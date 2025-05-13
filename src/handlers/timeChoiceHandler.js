const { sendMessageWithTyping } = require('../utils/messageUtils');
const { log } = require('../utils/log');
const mongoService = require('../services/mongoService');
const moment = require('moment-timezone');

function getConcreteDateForDayOfWeek(dayNameInPortuguese, timeString) {
    const timezone = 'America/Sao_Paulo';
    const now = moment().tz(timezone);
    const [hours, minutes] = timeString.split(':').map(Number);

    const dayMapping = {
        'domingo': 0, 'segunda': 1, 'terça': 2, 'quarta': 3,
        'quinta': 4, 'sexta': 5, 'sábado': 6
    };

    const targetDayOfWeek = dayMapping[dayNameInPortuguese.toLowerCase()];

    if (typeof targetDayOfWeek === 'undefined') {
        log(`Nome do dia inválido para cálculo de data: ${dayNameInPortuguese}`, 'error');
        return null;
    }

    let targetDateCandidate = now.clone().day(targetDayOfWeek);
    const candidateDateTime = targetDateCandidate.clone().hour(hours).minute(minutes).second(0).millisecond(0);

    if (candidateDateTime.isBefore(now)) {
        targetDateCandidate.add(1, 'week');
    }

    targetDateCandidate.hour(hours).minute(minutes).second(0).millisecond(0);
    log(`Data concreta calculada para ${dayNameInPortuguese} às ${timeString}: ${targetDateCandidate.format()}`, 'debug');
    return targetDateCandidate.toDate();
}

async function handleTimeChoice(client, msg, chat, userName, userFrom, messageBody, currentState, stateManager, appData) {
    const chosenTimeIndex = parseInt(messageBody, 10) - 1;
    const serviceName = currentState.data.serviceChosen;
    const dayKey = currentState.data.chosenDayKey;
    const dayName = currentState.data.chosenDayName;

    if (serviceName && dayKey && dayName &&
        appData.mockAvailability[serviceName] &&
        appData.mockAvailability[serviceName][dayKey]) {

        const dayInfo = appData.mockAvailability[serviceName][dayKey];
        if (dayInfo.times && chosenTimeIndex >= 0 && chosenTimeIndex < dayInfo.times.length) {
            const timeChosen = dayInfo.times[chosenTimeIndex];
            log(`User ${userFrom} chose time: ${timeChosen} (index: ${chosenTimeIndex}) for day ${dayName}, service ${serviceName}`, 'info');

            const concreteDate = getConcreteDateForDayOfWeek(dayName, timeChosen);

            if (!concreteDate) {
                log(`Não foi possível determinar a data concreta para ${dayName} às ${timeChosen} para o usuário ${userName}`, 'error');
                await sendMessageWithTyping(client, userFrom, "Desculpe, ocorreu um problema ao determinar a data do seu agendamento. Por favor, tente novamente ou contate o suporte.", chat);
                return;
            }

            const numeroContatoFormatado = msg.from ? msg.from.replace(/@c\.us$/, '') : '';
            const nomeClienteDoPayload = msg._data && msg._data.notifyName ? msg._data.notifyName : userName;

            const appointmentData = {
                nomeCliente: nomeClienteDoPayload,
                numeroContato: numeroContatoFormatado,
                servicoAgendado: serviceName,
                hora: timeChosen,
                data: concreteDate,
                clienteRecorrente: false
            };

            try {
                log(`Tentando criar agendamento no banco: ${JSON.stringify(appointmentData)}`, 'debug');
                await mongoService.createAppointment(appointmentData);
                log(`Agendamento criado com sucesso no banco para ${nomeClienteDoPayload} - ${serviceName} em ${moment(concreteDate).format('YYYY-MM-DD')} às ${timeChosen}`, 'info');

                await sendMessageWithTyping(client, userFrom, `Perfeito, ${nomeClienteDoPayload}! Seu agendamento para ${serviceName} na ${dayName} às ${timeChosen} foi realizado com sucesso.`, chat);
                await sendMessageWithTyping(client, userFrom, "Obrigado! Se precisar de mais alguma coisa, é só chamar.", chat);
                stateManager.deleteUserState(userFrom);

            } catch (dbError) {
                log(`Erro ao criar agendamento no banco para ${nomeClienteDoPayload}: ${dbError.message} ${dbError.stack}`, 'error');
                await sendMessageWithTyping(client, userFrom, "Desculpe, tivemos um problema ao registrar seu agendamento em nosso sistema. Por favor, tente novamente em alguns instantes.", chat);
            }

        } else {
            log(`Invalid time choice ${messageBody} for user ${userFrom}`, 'warn');
            await sendMessageWithTyping(client, userFrom,
                "Essa não é uma resposta prevista e portanto estou finalizando sua jornada.",
                chat);
            stateManager.deleteUserState(userFrom);
        }

    } else {
        log(`Invalid state/data for user ${userFrom} in handleTimeChoice. Current state data: ${JSON.stringify(currentState.data)}`, 'warn');
        await sendMessageWithTyping(client, userFrom,
            "Essa não é uma resposta prevista e portanto estou finalizando sua jornada.",
            chat);
        stateManager.deleteUserState(userFrom);
    }
}

module.exports = { handleTimeChoice };