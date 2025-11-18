const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows setup instructions for Luvi Helper Bot'),

  async execute(interaction) {
 const helpMessage = `
**Luvi Helper Bot Setup Guide**

1️⃣ **Set Boss Ping Roles:**
- \`/set-tier-role tier:1 role:@Role\`
- \`/set-tier-role tier:2 role:@Role\`
- \`/set-tier-role tier:3 role:@Role\` *(recommended to set at least Tier 3)*

2️⃣ **Set Card Ping Roles:**
- \`/set-card-role rarity:all role:@Role\`
- \`/set-card-role rarity:common role:@Role\`
- \`/set-card-role rarity:uncommon role:@Role\`
- \`/set-card-role rarity:rare role:@Role\`
- \`/set-card-role rarity:exotic role:@Role\`
- \`/set-card-role rarity:legendary role:@Role\`

- \`To remove any of the pings run the same command without the role\`
  \`The bot will ping those roles when bosses or cards spawn.\`

- \`/view-settings\` to view the current config.
- \`Make sure I have permission to mention the role.\`

3️⃣ **User Notification Settings:**
- \`/notifications set\` — Configure your personal notification preferences (e.g. expedition, stamina refill and raid fatigue.)
- \`/notifications view\` — View your current personal notification settings

For bugs or suggestions, join the support server (link in bio).
`;

    await interaction.reply({ content: helpMessage, flags: 1 << 6 }); 
  },
};
