/**
 * Simple logger function
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, error, warn)
 */
const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};

module.exports = {
  log,
};