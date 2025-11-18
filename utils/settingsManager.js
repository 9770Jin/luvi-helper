const BotSettings = require('../models/BotSettings');
const { sendLog, sendError } = require('./logger');

const settingsCache = new Map();

async function initializeSettings() {
  try {
    const allSettings = await BotSettings.find();
    allSettings.forEach(settings => {
      settingsCache.set(settings.guildId, settings);
    });
    await sendLog(`[INFO] Successfully cached settings for ${settingsCache.size} guilds.`);
  } catch (error) {
    console.error(`[ERROR] Failed to initialize settings cache: ${error.message}`, error);
    await sendError(`[ERROR] Failed to initialize settings cache: ${error.message}`);
  }
}

function getSettings(guildId) {
  return settingsCache.get(guildId);
}

async function updateSettings(guildId, newSettings) {
  try {
    const update = {};
    const toUnset = {};

    for (const key in newSettings) {
      if (newSettings[key] === undefined) {
        toUnset[key] = 1;
      } else {
        if (!update.$set) update.$set = {};
        update.$set[key] = newSettings[key];
      }
    }

    if (Object.keys(toUnset).length > 0) {
      update.$unset = toUnset;
    }

    const updatedSettings = await BotSettings.findOneAndUpdate(
      { guildId },
      update,
      { new: true, upsert: true }
    );

    settingsCache.set(guildId, updatedSettings);
    await sendLog(`[INFO] Settings updated for guild ${guildId}`);
    return updatedSettings;
  } catch (error) {
    console.error(`[ERROR] Failed to update settings for guild ${guildId}: ${error.message}`, error);
    await sendError(`[ERROR] Failed to update settings for guild ${guildId}: ${error.message}`);
    return null;
  }
}

function getCachedSettings() {
    return settingsCache;
}

module.exports = {
  initializeSettings,
  getSettings,
  updateSettings,
  getCachedSettings,
};
