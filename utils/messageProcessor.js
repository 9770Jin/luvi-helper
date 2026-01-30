const {
  parseBossEmbed,
  parseBossComponent,
  parseExpeditionEmbed,
  parseExpeditionComponent,
  parseRaidViewEmbed,
  parseRaidViewComponent,
} = require('./embedParser');

const { getSettings, updateSettings } = require('./settingsManager');
const Reminder = require('../models/Reminder');
const { sendError } = require('./logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { setTimer } = require('./timerManager');

const LUVI_ID = '1269481871021047891';

async function processMessage(message, oldMessage = null) {
  if (!message.guild || message.author.id !== LUVI_ID) return;

  // Ignore messages older than 60 seconds to prevent processing stale events
  if (Date.now() - message.createdTimestamp > 60000) return;

  try {
    // === STAMINA DETECTION ===
    if (message.content.includes("you don't have enough stamina!")) {
      let userId;

      if (message.interaction?.user?.id) {
        userId = message.interaction.user.id;
      } else if (message.mentions.users.size > 0) {
        userId = message.mentions.users.first().id;
      } else if (message.reference) {
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
          userId = referencedMessage.author.id;
        } catch (error) {
          console.error('Error fetching referenced message:', error);
          // Not critical enough to send to webhook, just console is fine for this specific logic check
        }
      }
      if (userId) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('stamina_25')
            .setLabel('Remind at 25% Stamina')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stamina_50')
            .setLabel('Remind at 50% Stamina')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stamina_100')
            .setLabel('Remind at 100% Stamina')
            .setStyle(ButtonStyle.Primary)
        );

        try {
          await message.channel.send({
            content: `<@${userId}>, I see you've run out of stamina. When would you like to be reminded?`,
            components: [row],
          });
        } catch (err) {
          if (err.code === 50013 || err.code === 50001) {
            console.warn(`[WARN] Missing permissions to send stamina message in channel ${message.channel.id}`);
          } else {
            console.error(`[ERROR] Failed to send stamina message: ${err.message}`, err);
            await sendError(`[ERROR] Failed to send stamina message: ${err.message}`);
          }
        }
      }
    }

    // Handle Embeds or Components
    const embed = message.embeds[0];
    const components = message.components;

    const raidInfo = embed ? parseRaidViewEmbed(embed) : parseRaidViewComponent(components);
    if (raidInfo) {
      // raidInfo is an array of { userId, fatigueMillis }
      for (const fatiguedUser of raidInfo) {
        const { userId, fatigueMillis } = fatiguedUser;

        // To prevent duplicate reminders from being created for the same fatigue event
        // (since raid embeds can be updated frequently), we check for an existing reminder
        // within a small time window around when this one would be set.
        const fiveSeconds = 5000;
        const remindAt = new Date(Date.now() + fatigueMillis);
        const existingReminder = await Reminder.findOne({
          userId,
          type: 'raid',
          remindAt: {
            $gte: new Date(remindAt.getTime() - fiveSeconds),
            $lte: new Date(remindAt.getTime() + fiveSeconds),
          },
        });

        if (!existingReminder) {
          try {
            await setTimer(message.client, {
              userId,
              channelId: message.channel.id,
              remindAt,
              type: 'raid',
              reminderMessage: `<@${userId}>, your raid fatigue has worn off! You can attack the boss again`,
            });
          } catch (error) {
            if (error.code === 11000) {
              // Suppress duplicate key errors
            } else {
              console.error(`[ERROR] Failed to create reminder for raid fatigue: ${error.message}`, error);
              await sendError(`[ERROR] Failed to create reminder for raid fatigue: ${error.message}`);
            }
          }
        }
      }
    }

    const isResendFromEmbed = embed?.title?.endsWith("Expedition Resend Results");
    const expInfoFromComp = parseExpeditionComponent(components);
    const isResendFromComp = expInfoFromComp?.isResend;

    if (isResendFromEmbed || isResendFromComp) {
      let userId = null;

      // 1. Try interaction metadata (direct or from reference)
      if (message.interactionMetadata?.user?.id) userId = message.interactionMetadata.user.id;
      else if (message.interaction?.user?.id) userId = message.interaction.user.id;

      // 2. Try fetching referenced message if we still don't have a user ID
      if (!userId && message.reference?.messageId) {
        try {
          const refMessage = await message.fetchReference();
          // Try getting ID from reference's interaction logic
          userId = refMessage.interactionMetadata?.user?.id || refMessage.interaction?.user?.id;

          // 3. Fallback: Parse the referenced message for username if interaction metadata is missing
          if (!userId) {
            const refEmbed = refMessage.embeds[0];
            const refComponents = refMessage.components;
            const refExpInfo = refEmbed ? parseExpeditionEmbed(refEmbed) : parseExpeditionComponent(refComponents);

            if (refExpInfo && refExpInfo.username) {
              try {
                const members = await message.guild.members.fetch({ query: refExpInfo.username, limit: 1 });
                const member = members.first();
                if (member) userId = member.id;
                else console.warn(`[WARN] Could not find guild member for username: ${refExpInfo.username} from referenced message`);
              } catch (err) {
                console.error(`[ERROR] Failed to fetch member for username from reference: ${refExpInfo.username}`, err);
              }
            }
          }
        } catch (err) {
          console.warn("[WARN] Failed to fetch referenced message for ID resolution:", err.message);
        }
      }

      const now = Date.now();
      const remindAt = new Date(now + 7_200_000); // 2 hours

      if (userId) {
        try {
          await setTimer(message.client, {
            userId,
            guildId: message.guild.id,
            channelId: message.channel.id,
            remindAt,
            type: 'expedition',
            reminderMessage: `<@${userId}>, your </expeditions:1426499105936379922> cards are ready to be claimed! \n-# Use \`@Luvi#1792 exps\` or \`/expeditions\` again for the bot to remind you next time.`,
          });
        } catch (err) {
          console.error(`[ERROR] Failed to set timer for expedition claim: ${err.message}`, err);
          await sendError(`[ERROR] Failed to set timer for expedition claim: ${err.message}`);
        }
      }

    } else {
      const expeditionInfo = embed ? parseExpeditionEmbed(embed) : expInfoFromComp;
      if (expeditionInfo && !expeditionInfo.isResend) {
        let userId = message.interaction?.user?.id;

        if (!userId && expeditionInfo.username) {
          try {
            const members = await message.guild.members.fetch({ query: expeditionInfo.username, limit: 1 });
            const member = members.first();
            if (member) userId = member.id;
            else await sendError(`[WARN] Could not find a guild member with username: ${expeditionInfo.username}`);
          } catch (err) {
            console.error(`[ERROR] Failed to fetch member for username: ${expeditionInfo.username}`, err);
            await sendError(`[ERROR] Failed to fetch member for username: ${expeditionInfo.username}`);
          }
        }

        if (userId) {
          const now = Date.now();

          // Find the card with the maximum remaining time
          let maxCard = null;
          for (const card of expeditionInfo.cards) {
            if (!maxCard || card.remainingMillis > maxCard.remainingMillis) {
              maxCard = card;
            }
          }

          if (maxCard) {
            try {
              const remindAt = new Date(now + maxCard.remainingMillis);

              // Check for existing expedition reminder
              const existingReminder = await Reminder.findOne({ userId, type: 'expedition' });

              if (existingReminder) {
                const timeDiff = Math.abs(existingReminder.remindAt.getTime() - remindAt.getTime());
                // If the difference is less than 1 minute (60000ms), assume it's the same reminder and do nothing
                if (timeDiff < 60000) {
                  return;
                }
              }

              await setTimer(message.client, {
                userId,
                cardId: maxCard.cardId,
                guildId: message.guild.id,
                channelId: message.channel.id,
                remindAt,
                type: 'expedition',
                reminderMessage: `<@${userId}>, your </expeditions:1426499105936379922> cards are ready to be claimed! \n-# Use \`@Luvi#1792 exps\` or \`/expeditions\` again for the bot to remind you next time.`,
              });
            } catch (error) {
              console.error(`[ERROR] Failed to create reminder for expedition: ${error.message}`, error);
              await sendError(`[ERROR] Failed to create reminder for expedition: ${error.message}`);
            }
          }
        } else if (embed) { // Only log if it was an embed (for components, we might not have a username yet)
          await sendError(`[WARN] Could not determine a userId for the expedition message. Title: ${embed.title}`);
        }
        return;
      }
    }

    // === RAID SPAWN DETECTION ===
    const title = ((embed ? embed.title : "") || "").toLowerCase();
    const description = ((embed ? embed.description : "") || "").toLowerCase();

    if (title.includes("raid spawned") || description.includes("raid spawned")) {
      let userId = null;

      // 1. Check if it was a slash command interaction
      if (message.interaction?.user?.id) {
        userId = message.interaction.user.id;
      }
      // 2. Fallback: Check recent text messages
      else {
        try {
          const messages = await message.channel.messages.fetch({ limit: 20 });
          const spawnMsg = messages.find(m =>
            !m.author.bot &&
            /\braid\s+spawn\b/i.test(m.content) &&
            (Date.now() - m.createdTimestamp < 20000) // Within last 20 seconds
          );
          if (spawnMsg) {
            userId = spawnMsg.author.id;
          }
        } catch (err) {
          console.error("Failed to fetch messages for raid spawn check:", err);
          await sendError(`[ERROR] Failed to fetch messages for raid spawn check: ${err.message}`);
        }
      }

      if (userId) {
        const thirtyMinutes = 30 * 60 * 1000;
        const remindAt = new Date(Date.now() + thirtyMinutes);

        try {
          await setTimer(message.client, {
            userId,
            guildId: message.guild.id,
            channelId: message.channel.id,
            remindAt,
            type: 'raid_spawn',
            reminderMessage: `<@${userId}>, your raid spawn cooldown is up! You can spawn another raid now </raid spawn:1404667045332910220>`
          });
        } catch (error) {
          if (error.code === 11000) {
            // Suppress log
          } else {
            console.error(`[ERROR] Failed to create reminder for raid spawn: ${error.message}`, error);
            await sendError(`[ERROR] Failed to create reminder for raid spawn: ${error.message}`);
          }
        }
      } else {
        await sendError(`[WARN] Could not determine a userId for the raid spawn message. Message ID: ${message.id}`);
      }
      return;
    }

    // === CARD DROP DETECTION ===
    if (title.includes("card dropped")) {
      try {
        const footer = embed?.footer;
        if (footer && footer.iconURL) {
          const avatarUrlMatch = footer.iconURL.match(/\/(?:avatars|users)\/(\d+)/);

          if (avatarUrlMatch && avatarUrlMatch[1]) {
            const userId = avatarUrlMatch[1];
            const oneHour = 60 * 60 * 1000;
            const remindAt = new Date(Date.now() + oneHour);

            try {
              await setTimer(message.client, {
                userId,
                guildId: message.guild.id,
                channelId: message.channel.id,
                remindAt,
                type: 'card_drop',
                reminderMessage: `<@${userId}>, your card drop cooldown is up! You can drop cards again using </drop:1464548731549384900>`
              });
            } catch (error) {
              if (error.code === 11000) {
                // Suppress duplicate reminder logs
              } else {
                console.error(`[ERROR] Failed to create reminder for card drop: ${error.message}`, error);
                await sendError(`[ERROR] Failed to create reminder for card drop: ${error.message}`);
              }
            }
          } else {
            await sendError(`[WARN] Card drop: Could not extract user ID from footer iconURL: ${footer.iconURL}`);
          }
        } else {
          await sendError(`[WARN] Card drop detected but no footer or iconURL found. Embed title: ${embed?.title}`);
        }
      } catch (error) {
        console.error(`[ERROR] Error processing card drop: ${error.message}`, error);
        await sendError(`[ERROR] Error processing card drop: ${error.message}`);
      }
      return;
    }

  } catch (error) {
    console.error(`[ERROR] Unhandled error in processMessage: ${error.message}`, error);
  }
}

async function processBossAndCardMessage(message) {
  if (!message.guild || message.author.id !== LUVI_ID) return;

  // Ignore messages older than 60 seconds to prevent processing stale events
  if (Date.now() - message.createdTimestamp > 60000) return;
  try {
    const embed = message.embeds[0];
    const components = message.components;

    const settings = getSettings(message.guild.id);
    if (!settings) return;

    const bossInfo = embed ? parseBossEmbed(embed) : parseBossComponent(components);
    if (bossInfo) {
      const tierMap = {
        'Tier 1': settings.t1RoleId,
        'Tier 2': settings.t2RoleId,
        'Tier 3': settings.t3RoleId,
      };
      const roleToPing = tierMap[bossInfo.tier];

      if (roleToPing) {
        try {
          const content = `<@&${roleToPing}> **${bossInfo.tier} Boss Spawned!**\nBoss: **${bossInfo.bossName}**`;
          await message.channel.send({ content, allowedMentions: { roles: [roleToPing] } });
        } catch (err) {
          if (err.code === 50013 || err.code === 50001) {
            console.warn(`[WARN] Missing permissions to send boss ping in channel ${message.channel.id}`);
          } else {
            console.error(`[ERROR] Failed to send boss ping: ${err.message}`, err);
            await sendError(`[ERROR] Failed to send boss ping: ${err.message}`);
          }
        }
      }
      return;
    }

  } catch (error) {
    console.error(`[ERROR] Unhandled error in processBossAndCardMessage: ${error.message}`, error);
  }
}

function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

module.exports = { processMessage, processBossAndCardMessage };