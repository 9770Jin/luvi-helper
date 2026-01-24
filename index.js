require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  PermissionsBitField,
  ActivityType,
  Options
} = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { initTimerManager } = require('./utils/timerManager');
const { initializeSettings } = require('./utils/settingsManager');
const { initializeUserSettings } = require('./utils/userSettingsManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 200,
    GuildMemberManager: 10,
    UserManager: 100,
    ThreadManager: 0,
    PresenceManager: 0,
    ReactionManager: 0,
    GuildScheduledEventManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 3600, // Every hour
      lifetime: 1800, // Remove messages older than 30 minutes
    },
    users: {
      interval: 3600,
      filter: () => user => user.id !== client.user.id, // Don't sweep self
    },
  },
});

// Load commands from ./commands folder
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.warn(`Skipped loading ${file}: missing data or execute`);
  }
}

// Load event handlers from ./events folder
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Load event handlers
const { processMessage, processBossAndCardMessage } = require('./utils/messageProcessor');

client.on(Events.MessageCreate, async (message) => {
  await processMessage(message);
  await processBossAndCardMessage(message);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  // We only care about updates to messages from the Luvi bot
  if (newMessage.author.id !== '1269481871021047891') return;
  await processMessage(newMessage, oldMessage);
});

// Guild join welcome/setup guide
client.on(Events.GuildCreate, async (guild) => {
  try {
    // Find first text channel where bot can send messages
    const defaultChannel = guild.channels.cache
      .filter(ch =>
        ch.type === 0 && // text channel
        ch.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
      )
      .first();

    if (!defaultChannel) {
      console.log(`No accessible text channel found in guild ${guild.name}`);
      return;
    }

    const guideMessage = `
**Hello! Thanks for adding Luvi Helper Bot!**

To set up the bot, please use these commands:

1️⃣ Set Boss Ping Roles:
- \`/set-tier-role tier:1 role:@Role\`
- \`/set-tier-role tier:2 role:@Role\`
- \`/set-tier-role tier:3 role:@Role\` *(recommended to set at least Tier 3)*



- \`/view-settings\` to view the current config.
- \`Make sure I have permission to mention the role.\`

3️⃣ **User Notification Settings:**
- \`/notifications set\` — Configure your personal notification preferences (e.g. expedition, stamina refill and raid fatigue.)
- \`/notifications view\` — View your current personal notification settings

For bugs or suggestions, join the support server (link in bio).
`;

    await defaultChannel.send(guideMessage);
    console.log(`Sent setup guide message in guild ${guild.name}`);
  } catch (error) {
    if (error.code === 50001) { // Missing Access
      console.warn(`[WARN] Could not send welcome message in ${guild.name}. The bot may be missing 'Send Messages' permissions in all accessible text channels.`);
    } else {
      console.error(`Failed to send setup message in guild ${guild.name}:`, error);
    }
  }
});

// Connect to MongoDB and login the bot
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Reminder = require('./models/Reminder');

    try {
      await Reminder.syncIndexes();
      console.log("Reminder indexes synced.");
    } catch (err) {
      console.error("Failed to sync Reminder indexes:", err);
    }

    client.once(Events.ClientReady, async readyClient => {
      console.log(`Bot logged in as ${readyClient.user.tag}`);
      await initializeSettings();
      await initializeUserSettings();
      initTimerManager(readyClient);

      const updateStatus = () => {
        const serverCount = readyClient.guilds.cache.size;
        readyClient.user.setActivity(`Luvi bot in ${serverCount} servers`, { type: ActivityType.Watching });
      };

      updateStatus(); // Set status immediately
      setInterval(updateStatus, 300000); // Update every 5 minutes
    });

    await client.login(process.env.BOT_TOKEN);
  } catch (err) {
    console.error('Failed to connect or login:', err);
    process.exit(1);
  }
})();