const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  source: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual'
  },
  branchId: {
    type: String,
    default: null
  },
  manuallyMoved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const branchSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  color: {
    type: String,
    default: '#8400ff'
  },
  position: {
    type: String,
    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    default: 'top-left'
  },
  positionIndex: {
    type: Number,
    default: 0
  },
  customX: {
    type: Number,
    default: null
  },
  customY: {
    type: Number,
    default: null
  },
  ideaIds: [{
    type: String
  }]
});

const userContextSchema = new mongoose.Schema({
  acceptedTopics: [{
    type: String
  }],
  rejectedSuggestions: [{
    type: String
  }],
  inputHistory: [{
    type: String
  }]
});

const brainstormSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  projectId: {
    type: String,
    default: null  // Links to the user's idea/project
  },
  name: {
    type: String,
    default: 'Untitled Session',
    maxlength: 100
  },
  ideas: [ideaSchema],
  branches: [branchSchema],
  userContext: {
    type: userContextSchema,
    default: () => ({
      acceptedTopics: [],
      rejectedSuggestions: [],
      inputHistory: []
    })
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for user's sessions
brainstormSessionSchema.index({ userId: 1, createdAt: -1 });
brainstormSessionSchema.index({ userId: 1, isActive: 1 });
brainstormSessionSchema.index({ userId: 1, projectId: 1 });  // Find by user + project

module.exports = mongoose.model('BrainstormSession', brainstormSessionSchema, 'brainstormsessions');
