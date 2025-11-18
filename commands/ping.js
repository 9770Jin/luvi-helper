const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency'),

  async execute(interaction) {
    const ping = interaction.client.ws.ping;
    await interaction.reply(`🏓 Pong! Bot latency is ${ping}ms.`);
  },
};
