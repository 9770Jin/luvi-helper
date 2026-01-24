const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: { type: String },
  guildId: { type: String },
  cardId: { type: String },
  channelId: { type: String, required: true },
  remindAt: { type: Date, required: true, index: true },
  type: { type: String, required: true, enum: ['expedition', 'stamina', 'raid', 'raid_spawn', 'card_drop'] },
  reminderMessage: { type: String, required: true },

});


// Unique index for stamina and raid reminders (userId + type)
reminderSchema.index({ userId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: { $in: ['stamina', 'raid', 'expedition', 'raid_spawn', 'card_drop'] } } });

module.exports = mongoose.model('Reminder', reminderSchema);
