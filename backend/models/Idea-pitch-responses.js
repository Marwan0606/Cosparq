const mongoose = require('mongoose')

// Schema for storing idea history versions
const IdeaHistorySchema = new mongoose.Schema({
  idea: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updateSource: {
    type: String,
    enum: ['manual', 'ai_sync', 'initial'],
    default: 'manual',
  },
  updateSummary: {
    type: String,
    default: '',
  }
}, { _id: true });

// Schema for progress milestones (checklist items)
const MilestoneSchema = new mongoose.Schema({
  label: { type: String, required: true },
  completed: { type: Boolean, default: false },
}, { _id: true });

const UserIdeaSchema = new mongoose.Schema({
  // ── Summary (stored in "idea" for backward compatibility) ──
  idea: {
    type: String,
    required: [true, 'must provide summary'],
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'must provide userId'],
  },
  ideaName: {
    type: String,
    required: [true, 'must provide name']
  },

  // ── DNA Sections ──
  vision: {
    type: String,
    default: '',
    trim: true,
  },
  coreProblem: {
    type: String,
    default: '',
    trim: true,
  },
  targetAudience: {
    type: String,
    default: '',
    trim: true,
  },
  revenueModel: {
    type: String,
    default: '',
    trim: true,
  },
  competitiveLandscape: {
    type: String,
    default: '',
    trim: true,
  },
  mvpScope: {
    type: String,
    default: '',
    trim: true,
  },
  brandIdentity: {
    description: { type: String, default: '' },
    colors: { type: [String], default: [] },
    fonts: { type: [String], default: [] },
  },
  techStack: {
    tags: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  progressStage: {
    type: String,
    enum: ['idea', 'validating', 'designing', 'building-mvp', 'mvp-done', 'launched', 'growing', 'scaling'],
    default: 'idea',
  },
  progressNotes: {
    type: String,
    default: '',
    trim: true,
  },
  progressMilestones: {
    type: [MilestoneSchema],
    default: [],
  },
  progressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  progressPercentManual: {
    type: Boolean,
    default: false,
  },

  // ── Existing fields ──
  ideaHistory: {
    type: [IdeaHistorySchema],
    default: [],
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  },
  archived: {
    type: Boolean,
    default: false,
  }
}, {collection: 'user-ideas', timestamps: true});

module.exports = mongoose.model('Idea', UserIdeaSchema);