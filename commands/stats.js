const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { getUserSettingsCache } = require('../utils/userSettingsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Displays bot statistics and memory usage.'),
    async execute(interaction) {
        if (interaction.user.id !== '640517686480338948') {
            return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
        }

        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        const client = interaction.client;

        const formatBytes = (bytes) => {
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 Byte';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        };

        const formatUptime = (s) => {
            const d = Math.floor(s / (3600 * 24));
            s %= 3600 * 24;
            const h = Math.floor(s / 3600);
            s %= 3600;
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${d}d ${h}h ${m}m ${sec}s`;
        };

        let totalMessages = 0;
        client.channels.cache.forEach(c => {
            if (c.messages && c.messages.cache) {
                totalMessages += c.messages.cache.size;
            }
        });

        const syncedUsers = getUserSettingsCache().size;

        const embed = new EmbedBuilder()
            .setTitle('Bot Statistics')
            .setColor('#00FF00')
            .addFields(
                { name: 'Memory Usage', value: `RSS: ${formatBytes(memoryUsage.rss)}\nHeap Used: ${formatBytes(memoryUsage.heapUsed)}\nHeap Total: ${formatBytes(memoryUsage.heapTotal)}`, inline: true },
                { name: 'Uptime', value: formatUptime(uptime), inline: true },
                { name: 'Cache Stats', value: `Guilds: ${client.guilds.cache.size}\nUsers: ${syncedUsers}\nChannels: ${client.channels.cache.size}\nMessages: ${totalMessages}`, inline: false },
                { name: 'Database', value: `Connection State: ${mongoose.connection.readyState}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
