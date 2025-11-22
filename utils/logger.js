const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
const { WebhookClient } = require('discord.js');

const logFilePath = path.join(__dirname, '..', 'logs', 'bot.log'); // Path to logs/bot.log
const errorWebhook = process.env.ERROR_WEBHOOK_URL ? new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL }) : null;

// Function to ensure the log directory exists
async function ensureLogDirectory() {
  const logDir = path.dirname(logFilePath);
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create log directory:', err);
  }
}

// Ensure directory on startup
ensureLogDirectory();

async function sendLog(message) {
  try {
    const timestamp = new Date().toISOString();
    await fs.appendFile(logFilePath, `[${timestamp}] ${message}\n`);
  } catch (error) {
    console.error('Failed to write log message to file:', error);
  }
}

async function sendError(message) {
  if (!errorWebhook) {
    console.error('ERROR_WEBHOOK_URL is not set. Failed to send error message to webhook.');
    return;
  }
  try {
    await errorWebhook.send(message);
  } catch (error) {
    console.error('Failed to send error message to webhook:', error);
  }
}

module.exports = { sendLog, sendError };