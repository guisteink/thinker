const { handleInitialChoice } = require('./initialHandler');
const { handleServiceChoice } = require('./serviceChoiceHandler');
const { handleDayChoice } = require('./dayChoiceHandler'); // Correto
const { handleTimeChoice } = require('./timeChoiceHandler'); // Correto
const { handleDefault } = require('./defaultHandler');

module.exports = {
    handleInitialChoice,
    handleServiceChoice,
    handleDayChoice,
    handleTimeChoice,
    handleDefault
};