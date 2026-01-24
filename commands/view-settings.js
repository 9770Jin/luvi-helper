const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const BotSettings = require('../models/BotSettings');

const BOT_OWNER_ID = '640517686480338948';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-settings')
    .setDescription('View current boss tier roles'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: 1 << 6 });
    }

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

      const embed = {
        color: 0x00bcd4,
        title: '📊 Current Boss Tier Role Settings',
        description: [
          `**Tier 3 Role:** ${t3}`,
          `**Tier 2 Role:** ${t2}`,
          `**Tier 1 Role:** ${t1}`
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
