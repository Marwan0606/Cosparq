const mongoose = require('mongoose');

const WaitlistEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },   // CoSparq user who owns the landing page
  ideaId: { type: String, required: true, index: true },   // Which idea/landing page
  subscriberName: { type: String, default: '' },
  subscriberEmail: { type: String, required: true },
}, { timestamps: true });

// Prevent duplicate emails per idea
WaitlistEntrySchema.index({ userId: 1, ideaId: 1, subscriberEmail: 1 }, { unique: true });

module.exports = mongoose.model('WaitlistEntry', WaitlistEntrySchema, 'waitlist-entries');
