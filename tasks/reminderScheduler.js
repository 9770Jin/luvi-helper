const Reminder = require('../models/Reminder');
const { getUserSettings, getUserSettingsCache } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');

async function checkReminders(client) {
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({ remindAt: { $lte: now } });

    if (dueReminders.length === 0) return;

    const remindersToProcess = dueReminders.reduce((acc, reminder) => {
      const key = reminder.type === 'raid_reset' ? `${reminder.guildId}-${reminder.type}` : `${reminder.userId}-${reminder.reminderMessage}`;
      if (!acc[key]) {
        acc[key] = {
          userId: reminder.userId,
          guildId: reminder.guildId,
          channelId: reminder.channelId,
          reminderMessage: reminder.reminderMessage,
          type: reminder.type, // Add type to the grouped data
          reminderIds: [],
        };
      }
      acc[key].reminderIds.push(reminder._id);
      return acc;
    }, {});

    for (const key in remindersToProcess) {
      const reminderData = remindersToProcess[key];
      try {
        const userSettings = getUserSettings(reminderData.userId);
        const sendReminder = !userSettings || userSettings[reminderData.type] !== false;

        if (reminderData.type === 'raid') {
          if (sendReminder) {
            const user = await client.users.fetch(reminderData.userId);
            if (user) {
              await user.send(reminderData.reminderMessage);
              await sendLog(`[RAID REMINDER SENT] User: ${reminderData.userId} via DM`);
            }
          }
        } else { // expedition and stamina
          if (sendReminder) {
            const channel = await client.channels.fetch(reminderData.channelId);
            if (channel) {
              await channel.send(reminderData.reminderMessage);
              await sendLog(`[REMINDER SENT] User: ${reminderData.userId} in Channel: ${reminderData.channelId}`);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to send reminder for user ${reminderData.userId}:`, error);
        await sendError(`[ERROR] Failed to send reminder for user ${reminderData.userId}:\n${error.message}`);
      }

      // Clean up all processed reminders for this user and message
      try {
        await Reminder.deleteMany({ _id: { $in: reminderData.reminderIds } });
      } catch (error) {
        console.error(`Failed to delete reminders for user ${reminderData.userId}:`, error);
        await sendError(`[ERROR] Failed to delete reminders for user ${reminderData.userId}:\n${error.message}`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Error in checkReminders: ${error.message}`, error);
  }
}

function startScheduler(client) {
  // Check every 5 seconds
  setInterval(() => checkReminders(client), 5 * 1000);
  sendLog('[SCHEDULER] Reminder scheduler started.');
}

module.exports = { startScheduler };

