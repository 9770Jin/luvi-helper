const { WebhookClient } = require('discord.js');

const logWebhook = process.env.LOG_WEBHOOK_URL ? new WebhookClient({ url: process.env.LOG_WEBHOOK_URL }) : null;
const errorWebhook = process.env.ERROR_WEBHOOK_URL ? new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL }) : null;

async function sendLog(message) {
  if (!logWebhook) return;
  try {
    await logWebhook.send(message);
  } catch (error) {
    console.error('Failed to send log message:', error);
  }
}

async function sendError(message) {
  if (!errorWebhook) return;
  try {
    await errorWebhook.send(message);
  } catch (error) {
    console.error('Failed to send error message:', error);
  }
}

module.exports = { sendLog, sendError };