# Luvi Helper

A Discord bot to help with Luvi.

## Features

- Set roles for boss pings based on tier.
- Set roles for card pings based on rarity.
- Personal notifications for expedition, stamina refill and raid fatigue.

## Commands

### Admin Commands

- `/set-tier-role tier:<1-3> role:<@Role>`: Set a role to be pinged when a boss of a certain tier spawns.
- `/set-card-role rarity:<rarity> role:<@Role>`: Set a role to be pinged when a card of a certain rarity spawns.
- `/view-settings`: View the current server settings for the bot.

### User Commands

- `/notifications set`: Configure your personal notification preferences (e.g. expedition, stamina refill and raid fatigue.)
- `/notifications view`: View your current personal notification settings.
- `/help`: Shows the setup instructions for the bot.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/9770Jin/luvi-helper.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and add your bot token and other necessary environment variables. See `.env.example` for reference.
4. Deploy commands:
   ```bash
   node deploy-commands.js
   ```
5. Start the bot:
   ```bash
   npm start
   ```

## Usage

Once the bot is running, you can use the commands listed above in your Discord server. Make sure the bot has the necessary permissions to mention roles and send messages.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
