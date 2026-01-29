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
              { name: 'Raid Fatigue', value: 'raid' },
              { name: 'Raid Spawn', value: 'raid_spawn' },
              { name: 'Card Drop', value: 'card_drop' },
              { name: 'DM Notifications', value: 'dmNotifications' }
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
        settings = { expedition: true, stamina: true, raid: true, raid_spawn: true, card_drop: true, dmNotifications: false };
      }

      await interaction.reply({
        embeds: [{
          title: 'Your Notification Settings',
          fields: [
            { name: 'Expedition', value: settings.expedition ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Stamina', value: settings.stamina ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Raid Fatigue', value: settings.raid ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Raid Spawn', value: settings.raid_spawn ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Card Drop', value: settings.card_drop ? 'Enabled' : 'Disabled', inline: true },
            { name: 'DM Notifications', value: settings.dmNotifications ? 'Enabled' : 'Disabled', inline: true },
          ],
          color: 0x5865F2,
        }],
        flags: 1 << 6,
      });
    } else if (subcommand === 'set') {
      const type = interaction.options.getString('type');
      const enabled = interaction.options.getBoolean('enabled');

      await updateUserSettings(userId, { [type]: enabled });

      let replyContent;
      if (type === 'dmNotifications') {
        replyContent = `You will now ${enabled ? 'receive' : 'stop receiving'} the reminders in your DMs.`;
      } else {
        replyContent = `Notifications for **${type}** have been **${enabled ? 'enabled' : 'disabled'}**.`;
      }

      await interaction.reply({
        content: replyContent,
        flags: 1 << 6,
      });
    }
  },
};
