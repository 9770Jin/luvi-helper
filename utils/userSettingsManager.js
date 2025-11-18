const UserNotificationSettings = require('../models/UserNotificationSettings');
const { sendLog, sendError } = require('./logger');

const userSettingsCache = new Map();

async function initializeUserSettings() {
  try {
    const allUserSettings = await UserNotificationSettings.find();
    allUserSettings.forEach(settings => {
      userSettingsCache.set(settings.userId, settings);
    });
    await sendLog(`[INFO] Successfully cached settings for ${userSettingsCache.size} users.`);
  } catch (error) {
    console.error(`[ERROR] Failed to initialize user settings cache: ${error.message}`, error);
    await sendError(`[ERROR] Failed to initialize user settings cache: ${error.message}`);
  }
}

function getUserSettings(userId) {
  return userSettingsCache.get(userId);
}

async function updateUserSettings(userId, newSettings) {
  try {
    const updatedSettings = await UserNotificationSettings.findOneAndUpdate(
      { userId },
      { $set: newSettings },
      { new: true, upsert: true }
    );

    userSettingsCache.set(userId, updatedSettings);
    await sendLog(`[INFO] User settings updated for user ${userId}`);
    return updatedSettings;
  } catch (error) {
    console.error(`[ERROR] Failed to update user settings for user ${userId}: ${error.message}`, error);
    await sendError(`[ERROR] Failed to update user settings for user ${userId}: ${error.message}`);
    return null;
  }
}

function getUserSettingsCache() {
  return userSettingsCache;
}

module.exports = {
  initializeUserSettings,
  getUserSettings,
  updateUserSettings,
  getUserSettingsCache,
};
