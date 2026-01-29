const { Events } = require('discord.js');
const Reminder = require('../models/Reminder');
const { setTimer } = require('../utils/timerManager');
const { sendLog, sendError } = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
                    }
                } catch (e) {
                    console.error(`Error sending error reply for ${interaction.commandName}:`, e);
                }
            }
        } else if (interaction.isButton()) {
            const { customId, user, channel, message } = interaction;

            if (customId.startsWith('stamina_')) {
                const mentionedUserIdMatch = message.content.match(/<@(\d+)>/);
                const mentionedUserId = mentionedUserIdMatch ? mentionedUserIdMatch[1] : null;

                if (mentionedUserId && user.id !== mentionedUserId) {
                    try {
                        return await interaction.reply({ content: "You can't interact with this button.", flags: 1 << 6 });
                    } catch (err) {
                        if (err.code === 10062) return; // Ignore Unknown Interaction
                        throw err;
                    }
                }

                try {
                    await interaction.deferReply({ flags: 1 << 6 });
                } catch (err) {
                    if (err.code === 10062) {
                        console.log(`[Interaction] Interaction ${interaction.id} expired before deferring.`);
                        return;
                    }
                    throw err;
                }

                const percentage = parseInt(customId.split('_')[1], 10);
                const maxStamina = 50;
                const staminaToRegen = (maxStamina * percentage) / 100;
                const minutesToRegen = staminaToRegen * 2; // 5 stamina per 10 mins = 1 stamina per 2 mins
                const remindAt = new Date(Date.now() + minutesToRegen * 60 * 1000);

                try {
                    const existingReminder = await Reminder.findOne({ userId: user.id, type: 'stamina' });
                    let confirmationMessage = `You will be reminded when your stamina reaches ${percentage}%.`;

                    if (existingReminder) {
                        // We no longer manually delete. setTimer will update it in place.
                        confirmationMessage = `Your previous stamina reminder was overwritten. You will now be reminded when your stamina reaches ${percentage}%.`;
                    }

                    await setTimer(interaction.client, {
                        userId: user.id,
                        guildId: interaction.guildId,
                        channelId: channel.id,
                        remindAt,
                        type: 'stamina',
                        reminderMessage: `<@${user.id}>, your stamina has regenerated to ${percentage}%! Time to </clash:1426499105936379915>`
                    });

                    try {
                        await interaction.editReply({ content: confirmationMessage });
                    } catch (err) {
                        if (err.code === 10062) return;
                        throw err;
                    }

                    await sendLog(`[STAMINA REMINDER SET] User: ${user.id}, Percentage: ${percentage}%, Channel: ${channel.id}, Message ID: ${message.id}, Message Link: ${message.url}`);

                    const originalMessage = interaction.message;
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId('stamina_25').setLabel('Remind at 25% Stamina').setStyle(ButtonStyle.Primary).setDisabled(true),
                            new ButtonBuilder().setCustomId('stamina_50').setLabel('Remind at 50% Stamina').setStyle(ButtonStyle.Primary).setDisabled(true),
                            new ButtonBuilder().setCustomId('stamina_100').setLabel('Remind at 100% Stamina').setStyle(ButtonStyle.Primary).setDisabled(true),
                        );
                    try {
                        await originalMessage.edit({ components: [disabledRow] });
                    } catch (e) {
                        if (e.code === 10008) { // Unknown Message
                            console.log(`Failed to disable buttons: message was deleted.`);
                        } else {
                            console.error('Failed to disable buttons:', e);
                        }
                    }
                } catch (error) {
                    console.error(`[ERROR] Failed to create stamina reminder: ${error.message}`, error);
                    await sendError(`[ERROR] Failed to create stamina reminder: ${error.message}`);
                    try {
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply({ content: 'Sorry, there was an error setting your reminder.' });
                        } else {
                            await interaction.reply({ content: 'Sorry, there was an error setting your reminder.', flags: 1 << 6 });
                        }
                    } catch (e) {
                        if (e.code === 10062) return;
                        console.error('Failed to send error message for stamina reminder:', e);
                    }
                }
            }
        }
    },
};