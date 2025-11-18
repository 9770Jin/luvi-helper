const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getSettings, updateSettings } = require('../utils/settingsManager');

const validRarities = ['all', 'common', 'uncommon', 'rare', 'exotic', 'legendary'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-card-role')
    .setDescription('Set or remove the role to ping for a card rarity or all cards')
    .addStringOption(option =>
      option
        .setName('rarity')
        .setDescription('Card rarity to set/remove role for')
        .setRequired(true)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Common', value: 'common' },
          { name: 'Uncommon', value: 'uncommon' },
          { name: 'Rare', value: 'rare' },
          { name: 'Exotic', value: 'exotic' },
          { name: 'Legendary', value: 'legendary' }
        ))
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to ping (leave empty to remove the role)')
        .setRequired(false)),

  async execute(interaction) {
    const botOwnerId = '640517686480338948';
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
      interaction.user.id !== botOwnerId
    ) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 1 << 6 });
    }

    const rarity = interaction.options.getString('rarity').toLowerCase();
    const role = interaction.options.getRole('role'); // may be null

    if (role && role.guild.id !== interaction.guild.id) {
      return interaction.reply({ content: '❌ The role must be from this server.', flags: 1 << 6 });
    }

    try {
      const settings = getSettings(interaction.guild.id) || { guildId: interaction.guild.id, cardPingRoles: new Map() };

      if (role) {
        settings.cardPingRoles.set(rarity, role.id);
      } else {
        settings.cardPingRoles.delete(rarity);
      }

      const rolesObject = {};
      for (const [key, value] of settings.cardPingRoles.entries()) {
        rolesObject[key] = value;
      }

      await updateSettings(interaction.guild.id, { cardPingRoles: rolesObject });

      if (role) {
        await interaction.reply({ content: `✅ Role ${role} set for card rarity \`${rarity}\` successfully!`, flags: 1 << 6 });
      } else {
        await interaction.reply({ content: `✅ Role for card rarity \`${rarity}\` has been removed.`, flags: 1 << 6});
      }
    } catch (error) {
      console.error(`[ERROR] Failed to set card role: ${error.message}`, error);
      await interaction.reply({ content: '❌ An error occurred while trying to set the card role.', flags: 1 << 6 });
    }
  }
};
