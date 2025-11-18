const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const BotSettings = require('../models/BotSettings');

const BOT_OWNER_ID = '640517686480338948';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-settings')
    .setDescription('View current boss tier and card ping roles'),

  async execute(interaction) {
    const member = interaction.member;

    const hasPermission =
      member.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
      interaction.user.id === BOT_OWNER_ID;

    if (!hasPermission) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: 1 << 6,
      });
    }

    try {
      const guildId = interaction.guild.id;
      const settings = await BotSettings.findOne({ guildId });

      if (!settings) {
        return interaction.reply({
          content: '⚠️ No settings found for this server.',
         flags: 1 << 6,
        });
      }

      const t1 = settings.t1RoleId ? `<@&${settings.t1RoleId}>` : '❌ Not set';
      const t2 = settings.t2RoleId ? `<@&${settings.t2RoleId}>` : '❌ Not set';
      const t3 = settings.t3RoleId ? `<@&${settings.t3RoleId}>` : '❌ Not set';

      const cardRoles = settings.cardPingRoles || {};
      const getRole = (rarity) => cardRoles.get(rarity) ? `<@&${cardRoles.get(rarity)}>` : '❌ Not set';

      const cardAll = getRole('all');
      const cardCommon = getRole('common');
      const cardUncommon = getRole('uncommon');
      const cardRare = getRole('rare');
      const cardExotic = getRole('exotic');
      const cardLegendary = getRole('legendary');

      const embed = {
        color: 0x00bcd4,
        title: '📊 Current Role Settings',
        description: [
          `**Tier 3 Role:** ${t3}`,
          `**Tier 2 Role:** ${t2}`,
          `**Tier 1 Role:** ${t1}`,
          '',
          `**Card Role (All):** ${cardAll}`,
          `**Card Role (Common):** ${cardCommon}`,
          `**Card Role (Uncommon):** ${cardUncommon}`,
          `**Card Role (Rare):** ${cardRare}`,
          `**Card Role (Exotic):** ${cardExotic}`,
          `**Card Role (Legendary):** ${cardLegendary}`
        ].join('\n'),
        footer: { text: 'Luvi Helper Settings' }
      };

      await interaction.reply({ embeds: [embed], flags: 1 << 6 });
    } catch (error) {
      console.error(`[ERROR] Failed to view settings: ${error.message}`, error);
      await interaction.reply({ content: '❌ An error occurred while trying to view settings.', flags: 1 << 6 });
    }
  },
};
