const mongoose = require('mongoose');

/**
 * Schema for individual transcript messages
 */
const TranscriptMessageSchema = new mongoose.Schema({
  speaker: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Schema for next step items with priority
 */
const NextStepSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low', null],
    default: null
  },
  completed: {
    type: Boolean,
    default: false
  }
}, { _id: true });

/**
 * Schema for the AI-generated meeting summary
 */
const SummarySchema = new mongoose.Schema({
  ideaStanding: {
    type: String,
    default: ''
  },
  discussed: {
    type: [String],
    default: []
  },
  insights: {
    type: [String],
    default: []
  },
  whatsNew: {
    type: [String],
    default: []
  },
  nextSteps: {
    type: [NextStepSchema],
    default: []
  }
}, { _id: false });

/**
 * Schema for context snapshot taken at meeting start
 * This captures the user's idea, scoreboard, and tasks at the time of the meeting
 */
const ContextSnapshotSchema = new mongoose.Schema({
  idea: {
    name: String,
    description: String
  },
  scoreboard: {
    score: Number,
    highlights: [String]
  },
  pendingTasks: {
    type: Number,
    default: 0
  },
  recentTasks: {
    type: [String],
    default: []
  }
}, { _id: false });

/**
 * Main CofounderSession Schema
 * Stores complete meeting data including transcript, summary, and metadata
 */
const CofounderSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  ideaId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Optional - can have general conversations without an idea
    index: true,
    default: null
  },
  // Meeting metadata
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // Duration in milliseconds
    default: 0
  },
  // Status of the session
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  // Full transcript of the conversation
  transcript: {
    type: [TranscriptMessageSchema],
    default: []
  },
  // Context snapshot at meeting start
  contextSnapshot: {
    type: ContextSnapshotSchema,
    default: {}
  },
  // AI-generated summary (populated when meeting ends)
  summary: {
    type: SummarySchema,
    default: null
  },
  // Whether summary was emailed to user
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  // Whether this summary has been synced to IdeaHub
  syncedToIdeaHub: {
    type: Boolean,
    default: false
  }
}, { 
  collection: 'cofounder-sessions',
  timestamps: true 
});

// Index for efficient queries
CofounderSessionSchema.index({ userId: 1, ideaId: 1, createdAt: -1 });
CofounderSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('CofounderSession', CofounderSessionSchema);
