const { handleInitialChoice } = require('./initialHandler');
const { handleServiceChoice } = require('./serviceChoiceHandler');
const { handleDayChoice } = require('./dayChoiceHandler'); 
const { handleTimeChoice } = require('./timeChoiceHandler'); 
const { handleDefault } = require('./defaultHandler');
const { handleCancelChoice } = require('./cancelHandler');

module.exports = {
    handleInitialChoice,
    handleServiceChoice,
    handleDayChoice,
    handleTimeChoice,
    handleCancelChoice,
    handleDefault
};