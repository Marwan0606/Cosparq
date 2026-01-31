const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  ideaId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['email', 'calendar', 'content', 'slides', 'form', 'sheets'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['success', 'pending', 'failed'],
    default: 'success',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Index for efficient queries
ActionLogSchema.index({ userId: 1, ideaId: 1, createdAt: -1 });

module.exports = mongoose.model('ActionLog', ActionLogSchema);
