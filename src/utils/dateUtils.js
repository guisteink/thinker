const { format, addDays, parse, getDay, setDay, isValid, parseISO } = require('date-fns');
const { ptBR } = require('date-fns/locale');

/**
 * Parses various date inputs into YYYY-MM-DD format.
 * Handles "hoje", "amanhã", day names (e.g., "segunda"), "DD/MM", "DD/MM/YYYY".
 * @param {string} input - The date string from the user.
 * @returns {string|null} Date in YYYY-MM-DD format or null if unparseable.
 */
function parseDateInput(input) {
    const now = new Date();
    const cleanedInput = input.toLowerCase().trim().replace('-feira', '');

    if (cleanedInput === 'hoje') {
        return format(now, 'yyyy-MM-dd');
    }
    if (cleanedInput === 'amanha' || cleanedInput === 'amanhã') {
        return format(addDays(now, 1), 'yyyy-MM-dd');
    }

    const dayMap = {
        'domingo': 0, 'segunda': 1, 'terca': 2, 'terça': 2, 'quarta': 3,
        'quinta': 4, 'sexta': 5, 'sabado': 6, 'sábado': 6
    };

    if (dayMap.hasOwnProperty(cleanedInput)) {
        const targetDayOfWeek = dayMap[cleanedInput];
        let targetDate = now;
        // Adjust to the target day of the week, ensuring it's in the future or today
        while (getDay(targetDate) !== targetDayOfWeek || targetDate < now && format(targetDate, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) {
            if (getDay(targetDate) === targetDayOfWeek && targetDate < now) { // Same day of week but in the past
                 targetDate = addDays(targetDate, 7); // Move to next week
                 break;
            }
            targetDate = addDays(targetDate, 1);
            if (getDay(targetDate) === targetDayOfWeek && targetDate < now && format(targetDate, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) {
                 targetDate = addDays(targetDate, 7); // Move to next week
                 break;
            }
             // Safety break for very distant future dates if logic is flawed, though unlikely here
            if (targetDate > addDays(now, 365)) return null;
        }
         // If today is the target day, and it's not in the past
        if (getDay(now) === targetDayOfWeek && format(now, 'yyyy-MM-dd') >= format(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 'yyyy-MM-dd')) {
            targetDate = now;
        } else {
            // Find the next occurrence of the target day
            targetDate = setDay(now, targetDayOfWeek, { weekStartsOn: 1 /* Monday */ });
            // If the calculated date is in the past (for this week), advance to next week
            if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                 targetDate = addDays(targetDate, 7);
            }
        }
        return format(targetDate, 'yyyy-MM-dd');
    }

    let parsedDateAttempt;
    // Try DD/MM/YYYY
    if (cleanedInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        parsedDateAttempt = parse(cleanedInput, 'dd/MM/yyyy', new Date());
        if (isValid(parsedDateAttempt)) return format(parsedDateAttempt, 'yyyy-MM-dd');
    }
    // Try DD/MM (assumes current year)
    if (cleanedInput.match(/^\d{1,2}\/\d{1,2}$/)) {
        parsedDateAttempt = parse(cleanedInput, 'dd/MM', new Date());
        if (isValid(parsedDateAttempt)) {
            // If the date is in the past for the current year, it might be an error or for next year.
            // For simplicity, we'll allow past dates if user explicitly types DD/MM for current year.
            // Or, one could advance it to the next year if it's significantly in the past.
            return format(parsedDateAttempt, 'yyyy-MM-dd');
        }
    }
    // Try YYYY-MM-DD
    if (cleanedInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsedDateAttempt = parseISO(cleanedInput);
        if (isValid(parsedDateAttempt)) return format(parsedDateAttempt, 'yyyy-MM-dd');
    }

    return null; // Could not parse
}

module.exports = { parseDateInput };