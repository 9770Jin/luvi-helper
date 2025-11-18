const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  t1RoleId: { type: String },
  t2RoleId: { type: String },
  t3RoleId: { type: String },

  raidResetPingChannelId: { type: String },
  raidResetPingRoleId: { type: String },

  cardPingRoles: {
    type: Map,
    of: String,
    default: {}, // example keys: 'all', 'common', 'uncommon', 'rare', 'exotic', 'legendary'
  }
});

module.exports = mongoose.model('BotSettings', botSettingsSchema);
