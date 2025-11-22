const Reminder = require('../models/Reminder');
const { getUserSettings, getUserSettingsCache } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');

async function checkReminders(client) {
  const startTime = Date.now();
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({ remindAt: { $lte: now } });

    if (dueReminders.length === 0) return;

    const remindersToProcess = dueReminders.reduce((acc, reminder) => {
      const key = `${reminder.userId}-${reminder.reminderMessage}`;
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

    const sendPromises = [];
    const remindersToDelete = [];

    for (const key in remindersToProcess) {
      const reminderData = remindersToProcess[key];
      remindersToDelete.push(...reminderData.reminderIds);

      const sendPromise = (async () => {
        try {
          const userSettings = getUserSettings(reminderData.userId);
          const sendReminder = !userSettings || userSettings[reminderData.type] !== false;
          const sendInDm = userSettings && userSettings.dmNotifications;

          if (sendReminder) {
            if (reminderData.type === 'raid' || sendInDm) {
              const user = await client.users.fetch(reminderData.userId);
              if (user) {
                await user.send(reminderData.reminderMessage);
                await sendLog(`[REMINDER SENT] User: ${reminderData.userId} via DM`);
              }
            } else {
              const channel = await client.channels.fetch(reminderData.channelId);
              if (channel) {
                await channel.send(reminderData.reminderMessage);
                await sendLog(`[REMINDER SENT] User: ${reminderData.userId} in Channel: ${reminderData.channelId}`);
              }
            }
          }
        } catch (error) {
          if (error.code === 50007) { // Cannot send messages to this user
            console.log(`User ${reminderData.userId} cannot be DMed. Deleting reminder.`);
          } else if (error.code === 10003) { // Unknown Channel
            console.log(`Channel ${reminderData.channelId} for user ${reminderData.userId} not found. Deleting reminder.`);
          } else if (error.code === 50001) { // Missing Access
            console.log(`Missing access to channel ${reminderData.channelId} for user ${reminderData.userId}. Deleting reminder.`);
          } else {
            console.error(`Failed to send reminder for user ${reminderData.userId}:`, error);
            await sendError(`[ERROR] Failed to send reminder for user ${reminderData.userId}:\n${error.message}`);
          }
        }
      })();
      sendPromises.push(sendPromise);
    }

    await Promise.all(sendPromises);

    // Clean up all processed reminders
    if (remindersToDelete.length > 0) {
      try {
        await Reminder.deleteMany({ _id: { $in: remindersToDelete } });
      } catch (error) {
        console.error(`Failed to delete reminders:`, error);
        await sendError(`[ERROR] Failed to delete reminders:\n${error.message}`);
      }
    }

  } catch (error) {
    console.error(`[ERROR] Error in checkReminders: ${error.message}`, error);
  }
  const endTime = Date.now();
  sendLog(`[SCHEDULER] checkReminders took ${endTime - startTime}ms to run.`);
}

function startScheduler(client) {
  // Check every 10 seconds
  (function schedule() {
    checkReminders(client).finally(() => setTimeout(schedule, 10 * 1000));
  })();
  sendLog('[SCHEDULER] Reminder scheduler started.');
}

module.exports = { startScheduler };
