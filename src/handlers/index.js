const { handleInitialChoice } = require('./initialHandler');
const { handleServiceChoice } = require('./serviceChoiceHandler');
const { handleDayChoice } = require('./dayChoiceHandler'); 
const { handleTimeChoice } = require('./timeChoiceHandler'); 
const { handleDefault } = require('./defaultHandler');

module.exports = {
    handleInitialChoice,
    handleServiceChoice,
    handleDayChoice,
    handleTimeChoice,
    handleDefault
};