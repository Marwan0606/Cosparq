const mongoose = require('mongoose');

// Schema for PRD history
const PrdSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  ideaName: {
    type: String,
    default: 'Unnamed Idea'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Schema for AI Prompt history
const PromptSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    required: true
  },
  promptType: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Main schema for PRD & Prompt storage per user per idea
const PrdPromptSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  ideaId: {
    type: String,
    required: true,
    index: true
  },
  // PRD data
  prds: {
    type: [PrdSchema],
    default: []
  },
  lastPrdGeneratedAt: {
    type: Date,
    default: null
  },
  // AI Prompt data
  prompts: {
    type: [PromptSchema],
    default: []
  },
  lastPromptGeneratedAt: {
    type: Date,
    default: null
  }
}, { 
  collection: 'prd-prompts',
  timestamps: true 
});

// Compound index for efficient lookups
PrdPromptSchema.index({ userId: 1, ideaId: 1 }, { unique: true });

module.exports = mongoose.model('PrdPrompt', PrdPromptSchema);
