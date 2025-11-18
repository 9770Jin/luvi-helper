const { SlashCommandBuilder } = require('discord.js');
const { getUserSettings, updateUserSettings } = require('../utils/userSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notifications')
    .setDescription('Manage your notification settings.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your current notification settings.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Enable or disable a notification type.')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('The notification type to configure.')
            .setRequired(true)
            .addChoices(
              { name: 'Expedition', value: 'expedition' },
              { name: 'Stamina', value: 'stamina' },
              { name: 'Raid', value: 'raid' }
            ))
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Whether to enable or disable this notification.')
            .setRequired(true))
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'view') {
      let settings = getUserSettings(userId);
      if (!settings) {
        settings = { expedition: true, stamina: true, raid: true };
      }

      await interaction.reply({
        embeds: [{
          title: 'Your Notification Settings',
          fields: [
            { name: 'Expedition', value: settings.expedition ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Stamina', value: settings.stamina ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Raid', value: settings.raid ? 'Enabled' : 'Disabled', inline: true },
          ],
          color: 0x5865F2,
        }],
        ephemeral: true,
      });
    } else if (subcommand === 'set') {
      const type = interaction.options.getString('type');
      const enabled = interaction.options.getBoolean('enabled');

      await updateUserSettings(userId, { [type]: enabled });

      await interaction.reply({
        content: `Notifications for **${type}** have been **${enabled ? 'enabled' : 'disabled'}**.`,
        ephemeral: true,
      });
    }
  },
};
