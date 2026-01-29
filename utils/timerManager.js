const Reminder = require('../models/Reminder');
const { getUserSettings } = require('./userSettingsManager');
const { sendLog, sendError } = require('./logger');
const { getGuildChannel } = require('./messageUtils');

const timeoutMap = new Map();

/**
 * Sets a new timer.
 * @param {import('discord.js').Client} client 
 * @param {Object} reminderData 
 */
const setTimer = async (client, reminderData) => {
    try {
        if (timeoutMap.size >= 1000) {
            console.warn(`[WARN] TimerManager has ${timeoutMap.size} active timeouts. This might indicate a leak or heavy load.`);
            await sendError(`[WARN] TimerManager has ${timeoutMap.size} active timeouts. This might indicate a leak or heavy load.`);
        }

        // Use findOneAndUpdate with upsert to update existing reminder or create new one
        // This keeps the _id stable if the reminder already exists
        const reminder = await Reminder.findOneAndUpdate(
            { userId: reminderData.userId, type: reminderData.type },
            reminderData,
            { upsert: true, new: true }
        );

        scheduleNotification(client, reminder);
        return reminder;
    } catch (error) {
        console.error('[TimerManager] Error creating timer:', error);
        await sendError(`[ERROR] [TimerManager] Error creating timer: ${error.message}`);
        throw error;
    }
};

/**
 * Deletes a timer by ID.
 * @param {string} reminderId 
 */
const deleteTimer = async (reminderId) => {
    try {
        await Reminder.findByIdAndDelete(reminderId);

        if (timeoutMap.has(reminderId)) {
            clearTimeout(timeoutMap.get(reminderId));
            timeoutMap.delete(reminderId);
        }
    } catch (error) {
        console.error(`[TimerManager] Error deleting timer ${reminderId}:`, error);
        await sendError(`[ERROR] [TimerManager] Error deleting timer ${reminderId}: ${error.message}`);
    }
};

/**
 * Schedules the notification for a reminder.
 * @param {import('discord.js').Client} client 
 * @param {Object} reminder 
 */
const scheduleNotification = (client, reminder) => {
    const now = Date.now();
    const delay = new Date(reminder.remindAt).getTime() - now;

    if (delay <= 0) {
        triggerNotification(client, reminder._id).catch(err => {
            console.error(`[TimerManager] Immediate trigger failed for ${reminder._id}:`, err);
        });
    } else {
        // If there's already a timeout for this reminder (shouldn't happen usually but good for safety), clear it
        if (timeoutMap.has(reminder._id.toString())) {
            clearTimeout(timeoutMap.get(reminder._id.toString()));
        }

        const timeoutId = setTimeout(() => {
            triggerNotification(client, reminder._id).catch(err => {
                console.error(`[TimerManager] Scheduled trigger failed for ${reminder._id}:`, err);
            });
        }, delay);

        timeoutMap.set(reminder._id.toString(), timeoutId);
    }
};

/**
 * Triggers the notification and cleans up.
 * @param {import('discord.js').Client} client 
 * @param {string} reminderId 
 */
const triggerNotification = async (client, reminderId) => {
    const idStr = reminderId.toString();
    if (timeoutMap.has(idStr)) {
        timeoutMap.delete(idStr);
    }

    try {
        const reminder = await Reminder.findById(reminderId);
        if (!reminder) {
            // console.log(`[TimerManager] Reminder ${reminderId} not found in DB (likely deleted).`);
            return;
        }

        // --- Notification Logic (Extracted from old scheduler) ---
        const userSettings = getUserSettings(reminder.userId);
        const sendReminder = !userSettings || userSettings[reminder.type] !== false;
        const sendInDm = userSettings && userSettings.dmNotifications;

        if (sendReminder) {
            try {
                let sentToChannel = false;
                const shouldForceDm = reminder.type === 'raid' || sendInDm;

                // Try sending to channel first if not forced to DM
                if (!shouldForceDm) {
                    try {
                        const channel = await getGuildChannel(client, reminder.channelId);
                        if (channel) {
                            await channel.send(reminder.reminderMessage);
                            await sendLog(`[REMINDER SENT] Type: ${reminder.type}, User: ${reminder.userId}, Channel: ${reminder.channelId}`);
                            sentToChannel = true;
                        } else {
                            console.log(`[TimerManager] Channel ${reminder.channelId} not found or inaccessible. Attempting DM fallback.`);
                            // We don't necessarily need to webhook this warn if fallback works, but let's leave it as console log to avoid spamming webhook if bot is kicked from a server
                        }
                    } catch (err) {
                        console.error(`[TimerManager] Failed to send to channel ${reminder.channelId}. Error Name: ${err.name}, Code: ${err.code}, Message: ${err.message}. Attempting DM fallback.`);
                        // Same here, handled by fallback
                    }
                }

                // Send via DM if forced OR if channel send failed
                if (shouldForceDm || !sentToChannel) {
                    const user = await client.users.fetch(reminder.userId);
                    if (user) {
                        let finalMessage = reminder.reminderMessage;

                        // Append "Jump to Channel" link for non-raid reminders if we have IDs
                        if (reminder.type !== 'raid' && reminder.guildId && reminder.channelId) {
                            finalMessage += `in (https://discord.com/channels/${reminder.guildId}/${reminder.channelId})`;
                        }

                        await user.send(finalMessage);
                        const logSuffix = sentToChannel === false && !shouldForceDm ? " (Fallback from Channel)" : "";
                        await sendLog(`[REMINDER SENT] Type: ${reminder.type}, User: ${reminder.userId} via DM${logSuffix}`);
                    }
                }
            } catch (error) {
                if (error.code === 50007) { // Cannot send messages to this user
                    console.log(`[TimerManager] User ${reminder.userId} cannot be DMed.`);
                } else if (error.code === 50013 || error.code === 50001) {
                    console.warn(`[TimerManager] Missing permissions to send reminder to user ${reminder.userId} (Code: ${error.code})`);
                } else {
                    console.error(`[TimerManager] Failed to send reminder for user ${reminder.userId} (Type: ${reminder.type}):`, error);
                    await sendError(`[ERROR] [TimerManager] Failed to send reminder for user ${reminder.userId} (Type: ${reminder.type}):\n${error.message}`);
                }
            }
        } else {
            // Debug log for skipped reminders
            console.log(`[TimerManager] Skipped reminder for user ${reminder.userId} type ${reminder.type} due to settings.`);
            // await sendLog(`[REMINDER SKIPPED] User: ${reminder.userId}, Type: ${reminder.type}`); // Optional, maybe too noisy if intended
        }

        // Delete from DB after triggering
        await Reminder.findByIdAndDelete(reminderId);

    } catch (error) {
        console.error(`[TimerManager] Error triggering notification for ${reminderId}:`, error);
        await sendError(`[ERROR] [TimerManager] Error triggering notification for ${reminderId}: ${error.message}`);
    }
};

/**
 * Initializes the timer manager by loading pending reminders from DB.
 * @param {import('discord.js').Client} client 
 */
const initTimerManager = async (client) => {
    try {
        const pendingReminders = await Reminder.find({});
        console.log(`[TimerManager] Loaded ${pendingReminders.length} pending reminders.`);

        for (const reminder of pendingReminders) {
            scheduleNotification(client, reminder);
        }
    } catch (error) {
        console.error('[TimerManager] Error initializing:', error);
        await sendError(`[ERROR] [TimerManager] Error initializing: ${error.message}`);
    }
};

module.exports = {
    setTimer,
    deleteTimer,
    initTimerManager
};
