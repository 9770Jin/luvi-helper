const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  t1RoleId: { type: String },
  t2RoleId: { type: String },
  t3RoleId: { type: String },

  raidResetPingChannelId: { type: String },
  raidResetPingRoleId: { type: String },


});

module.exports = mongoose.model('BotSettings', botSettingsSchema);
