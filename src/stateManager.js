const { log } = require('./utils/log'); // Import log

const userStates = new Map();

function getUserState(userFrom) {
    const state = userStates.get(userFrom) || { step: 'initial', data: {} };
    // log(`Retrieved state for ${userFrom}: ${JSON.stringify(state)}`, 'debug');
    return state;
}

function setUserState(userFrom, state) {
    userStates.set(userFrom, state);
    log(`Set state for ${userFrom}: ${JSON.stringify(state)}`, 'info');
}

function deleteUserState(userFrom) {
    const deleted = userStates.delete(userFrom);
    if (deleted) {
        log(`Deleted state for ${userFrom}.`, 'info');
    } else {
        log(`Attempted to delete state for ${userFrom}, but no state found.`, 'warn');
    }
}

function resetUserState(userFrom) {
    const initialState = { step: 'awaiting_initial_choice', data: {} };
    userStates.set(userFrom, initialState);
    log(`Reset state for ${userFrom} to initial: ${JSON.stringify(initialState)}`, 'info');
    return initialState;
}

module.exports = {
    getUserState,
    setUserState,
    deleteUserState,
    resetUserState
};