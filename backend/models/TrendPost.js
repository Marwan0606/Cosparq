const mongoose = require('mongoose');

/**
 * TrendPost Model
 * Stores raw posts scraped from various sources (Reddit, HN, ProductHunt, etc.)
 * These posts are analyzed by AI to extract trends and pain points
 */
const trendPostSchema = new mongoose.Schema({
  // Source identification
  source: {
    type: String,
    required: true,
    enum: ['reddit', 'hackernews', 'producthunt', 'twitter', 'taaft', 'betalist', 'github', 'other']
  },
  sourceId: {
    type: String,
    required: true
  },
  
  // Source-specific metadata
  subreddit: {
    type: String,
    trim: true
  },
  
  // Content
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    trim: true,
    default: ''
  },
  url: {
    type: String,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  
  // Engagement metrics
  upvotes: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  sourceCreatedAt: {
    type: Date
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  },
  
  // Processing status
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  processingError: {
    type: String
  },
  
  // AI-extracted fields (populated after processing)
  topics: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  painPoints: [{
    type: String,
    trim: true
  }],
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'mixed', null],
    default: null
  },
  demandSignal: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  category: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Relevance score (combination of engagement + demand signal)
  relevanceScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for preventing duplicates
trendPostSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// Index for finding unprocessed posts
trendPostSchema.index({ processed: 1, fetchedAt: -1 });

// Index for category aggregation
trendPostSchema.index({ category: 1, sourceCreatedAt: -1 });

// Index for topic searches
trendPostSchema.index({ topics: 1 });

// Text index for searching content
trendPostSchema.index({ title: 'text', content: 'text' });

// Index for time-based queries
trendPostSchema.index({ sourceCreatedAt: -1 });
trendPostSchema.index({ fetchedAt: -1 });

// Calculate relevance score before saving
trendPostSchema.pre('save', function(next) {
  if (this.isModified('demandSignal') || this.isModified('upvotes')) {
    // Relevance = demand signal weighted by engagement
    const engagementBonus = Math.log10(Math.max(this.upvotes || 1, 1) + 1) * 10;
    this.relevanceScore = (this.demandSignal || 0) + engagementBonus;
  }
  next();
});

module.exports = mongoose.model('TrendPost', trendPostSchema, 'trendposts');
