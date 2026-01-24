const { DiscordAPIError, PermissionsBitField } = require('discord.js');

/**
 * Fetches a guild text channel and verifies permissions.
 * @param {import('discord.js').Client} client 
 * @param {string} channelId 
 * @returns {Promise<import('discord.js').BaseGuildTextChannel | null>}
 */
const getGuildChannel = async (client, channelId) => {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;


        return channel;
    } catch (error) {
        if (error.code === 10003) { // Unknown Channel
            return null;
        }
        throw error;
    }
};

/**
 * Replies to a message safely, handling deleted messages and auto-deletion.
 * @param {import('discord.js').Message} message 
 * @param {string|import('discord.js').MessagePayload|import('discord.js').MessageReplyOptions} content 
 * @param {boolean} [autoDelete=false] 
 * @returns {Promise<void>}
 */
const reply = async (message, content, autoDelete = false) => {
    let msg = null;
    try {
        msg = await message.reply(content);
    } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 50035) { // Invalid Form Body (often triggered by replying to deleted message) or Unknown Message
            console.warn(`[REPLY] Could not reply to message ${message.id} in channel ${message.channelId}. Original message likely deleted.`);
            return;
        } else if (error.code === 10008) { // Unknown Message
            console.warn(`[REPLY] Could not reply to message ${message.id}. Message not found.`);
            return;
        }

        console.error('[Reply] Unexpected error when replying:', error);
        throw error;
    }

    if (autoDelete && msg) {
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (error) {
                if (error.code !== 10008) { // Ignore if already deleted
                    console.error('[AUTODELETE] Unexpected error when deleting message:', error);
                }
            }
        }, 15000);
    }
};

module.exports = { getGuildChannel, reply };
