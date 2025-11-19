const { 
  parseBossEmbed, 
  parseCardEmbed, 
  parseExpeditionEmbed, 
  parseRaidViewEmbed,
} = require('./embedParser');

const { getSettings, updateSettings } = require('./settingsManager');
const Reminder = require('../models/Reminder');
const { sendLog, sendError } = require('./logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const LUVI_ID = '1269481871021047891';

async function processMessage(message) {
  if (!message.guild || message.author.id !== LUVI_ID) return;

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

        await message.channel.send({
          content: `<@${userId}>, I see you've run out of stamina. When would you like to be reminded?`,
          components: [row],
        });
      }
      return;
    }

    if (!message.embeds.length) return;
    const embed = message.embeds[0];

    // === RAID FATIGUE DETECTION ===
    const raidInfo = parseRaidViewEmbed(embed);
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
            await Reminder.create({
              userId,
              channelId: message.channel.id,
              remindAt,
              type: 'raid',
              reminderMessage: `<@${userId}>, your raid fatigue has worn off! You can attack the boss again.\n-# you can configure your notifications via /notifications set/view`,
            });
            await sendLog(`[RAID REMINDER SET] User: ${userId}, Channel: ${message.channel.id}, In: ${Math.round(fatigueMillis / 1000)}s, Message ID: ${message.id}, Message Link: ${message.url}`);
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
      return;
    }

    // === EXPEDITION DETECTION ===
    const expeditionInfo = parseExpeditionEmbed(embed);
    if (expeditionInfo) {
      let userId = message.interaction?.user?.id;

      if (!userId && expeditionInfo.username) {
        try {
          const members = await message.guild.members.fetch({ query: expeditionInfo.username, limit: 1 });
          const member = members.first();
          if (member) userId = member.id;
          else console.warn(`[WARN] Could not find a guild member with username: ${expeditionInfo.username}`);
        } catch (err) {
          console.error(`[ERROR] Failed to fetch member for username: ${expeditionInfo.username}`, err);
        }
      }

      if (userId) {
        const now = Date.now();
        for (const card of expeditionInfo.cards) {
          const existingReminder = await Reminder.findOne({ userId, cardId: card.cardId });
          if (!existingReminder) {
            try {
              const remindAt = new Date(now + card.remainingMillis);
              await Reminder.create({
                userId,
                cardId: card.cardId,
                channelId: message.channel.id,
                remindAt,
                type: 'expedition',
                reminderMessage: `<@${userId}>, your expedition cards are ready to be claimed!\n-# Use \`@luvi exps\` or \`/expeditions\` again for the bot to remind you next time.\n-# you can configure your notifications via /notifications set/view`, 
              });
              await sendLog(`[EXPEDITION REMINDER SET] User: ${userId}, Card: ${card.cardName} (${card.cardId}), Channel: ${message.channel.id}, Message ID: ${message.id}, Message Link: ${message.url}`);
            } catch (error) {
              if (error.code === 11000) {
                console.log(`[INFO] Suppressed duplicate key error for expedition reminder. User: ${userId}, Card: ${card.cardId}`);
              } else {
                console.error(`[ERROR] Failed to create reminder for expedition: ${error.message}`, error);
                await sendError(`[ERROR] Failed to create reminder for expedition: ${error.message}`);
              }
            }
          }
        }
      } else {
        console.warn(`[WARN] Could not determine a userId for the expedition message. Title: ${embed.title}`);
      }
      return;
    }

  } catch (error) {
    console.error(`[ERROR] Unhandled error in processMessage: ${error.message}`, error);
  }
}

async function processBossAndCardMessage(message) {
  if (!message.guild || message.author.id !== LUVI_ID || !message.embeds.length) return;

  try {
    const embed = message.embeds[0];
    const settings = getSettings(message.guild.id);
    if (!settings) return;

    // === BOSS DETECTION ===
    const bossInfo = parseBossEmbed(embed);
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
          await sendLog(`[BOSS DETECTED] ${bossInfo.bossName} (${bossInfo.tier}) in guild ${message.guild.name}`);
        } catch (err) {
          console.error(`[ERROR] Failed to send boss ping: ${err.message}`, err);
          await sendError(`[ERROR] Failed to send boss ping: ${err.message}`);
        }
      }
      return;
    }

    // === CARD DETECTION ===
    const cardInfo = parseCardEmbed(embed);
    if (cardInfo) {
      const rarity = cardInfo.rarity.toLowerCase();
      const rolesToPing = [];

      if (settings.cardPingRoles) {
        // Make sure cardPingRoles works whether it's a Map or Object
        const getRole = (key) => {
          if (typeof settings.cardPingRoles.get === 'function') return settings.cardPingRoles.get(key);
          return settings.cardPingRoles[key];
        };

        const specificRole = getRole(rarity);
        const allRole = getRole('all');
        if (specificRole) rolesToPing.push(specificRole);
        if (allRole) rolesToPing.push(allRole);
      }

      const uniqueRolesToPing = [...new Set(rolesToPing)];

      if (uniqueRolesToPing.length > 0) {
        try {
          const rolePings = uniqueRolesToPing.map(id => `<@&${id}>`).join(' ');
          const content = `${rolePings} A **${cardInfo.rarity}** card just spawned!\n**${cardInfo.cardName}** from *${cardInfo.seriesName}*`;
          await message.channel.send({ content, allowedMentions: { roles: uniqueRolesToPing } });
          await sendLog(`[CARD DETECTED] ${cardInfo.cardName} (${cardInfo.rarity}) from ${cardInfo.seriesName} in guild ${message.guild.name}`);
        } catch (err) {
          console.error(`[ERROR] Failed to send card ping: ${err.message}`, err);
          await sendError(`[ERROR] Failed to send card ping: ${err.message}`);
        }
      }
      return;
    }

  } catch (error) {
    console.error(`[ERROR] Unhandled error in processBossAndCardMessage: ${error.message}`, error);
  }
}

module.exports = { processMessage, processBossAndCardMessage };