const mongoose = require('mongoose');

const userNotificationSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expedition: { type: Boolean, default: true },
  stamina: { type: Boolean, default: true },
  raid: { type: Boolean, default: true },
  raid_spawn: { type: Boolean, default: true },
  card_drop: { type: Boolean, default: true },
  dmNotifications: { type: Boolean, default: false },
});

module.exports = mongoose.model('UserNotificationSettings', userNotificationSettingsSchema);
