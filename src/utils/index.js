/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * Simple logger function
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, error, warn)
 */
const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};

const { parseDateInput } = require('./dateUtils');

module.exports = {
  delay,
  log,
  parseDateInput
};