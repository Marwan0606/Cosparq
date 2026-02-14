const mongoose = require('mongoose');

/**
 * TrendScore Model
 * Aggregated trend data for visualization on the market map
 * Updated daily by the trend aggregation cron job
 */
const dailyScoreSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  mentions: {
    type: Number,
    default: 0
  },
  avgUpvotes: {
    type: Number,
    default: 0
  },
  avgDemandSignal: {
    type: Number,
    default: 0
  },
  topPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrendPost'
  }]
}, { _id: false });

const trendScoreSchema = new mongoose.Schema({
  // Category identification
  category: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Parent category for hierarchical organization
  parentCategory: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Current metrics (latest aggregation)
  mentionCount: {
    type: Number,
    default: 0
  },
  weightedScore: {
    type: Number,
    default: 0
  },
  
  // Velocity = % change from previous period
  velocity: {
    type: Number,
    default: 0
  },
  velocityTrend: {
    type: String,
    enum: ['rising', 'stable', 'declining'],
    default: 'stable'
  },
  
  // Historical data (last 30 days)
  dailyScores: [dailyScoreSchema],
  
  // Top pain points extracted from posts in this category
  topPainPoints: [{
    painPoint: String,
    mentions: Number
  }],
  
  // Related topics that often appear together
  relatedTopics: [{
    topic: String,
    count: Number
  }],
  
  // Sample posts for this category
  samplePosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrendPost'
  }],
  
  // Map visualization position
  mapPosition: {
    x: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    y: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    region: {
      type: String,
      default: 'general'
    }
  },
  
  // Visual properties
  color: {
    type: String,
    default: '#8B5CF6'
  },
  icon: {
    type: String // emoji or icon name
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  aiGenerated: {
    type: Boolean,
    default: true
  },
  lastAggregatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for map queries
trendScoreSchema.index({ isActive: 1, weightedScore: -1 });
trendScoreSchema.index({ 'mapPosition.region': 1 });
trendScoreSchema.index({ parentCategory: 1 });
trendScoreSchema.index({ velocity: -1 });

// Virtual for heat level (for visualization)
trendScoreSchema.virtual('heatLevel').get(function() {
  if (this.velocity > 50) return 'hot';
  if (this.velocity > 20) return 'warm';
  if (this.velocity > 0) return 'neutral';
  if (this.velocity > -20) return 'cool';
  return 'cold';
});

// Method to calculate velocity from daily scores
trendScoreSchema.methods.calculateVelocity = function() {
  if (this.dailyScores.length < 2) {
    this.velocity = 0;
    this.velocityTrend = 'stable';
    return;
  }
  
  // Compare last 7 days to previous 7 days
  const recentDays = this.dailyScores.slice(-7);
  const previousDays = this.dailyScores.slice(-14, -7);
  
  if (previousDays.length === 0) {
    this.velocity = 0;
    this.velocityTrend = 'stable';
    return;
  }
  
  const recentTotal = recentDays.reduce((sum, d) => sum + d.mentions, 0);
  const previousTotal = previousDays.reduce((sum, d) => sum + d.mentions, 0);
  
  if (previousTotal === 0) {
    this.velocity = recentTotal > 0 ? 100 : 0;
  } else {
    this.velocity = ((recentTotal - previousTotal) / previousTotal) * 100;
  }
  
  // Set trend
  if (this.velocity > 10) this.velocityTrend = 'rising';
  else if (this.velocity < -10) this.velocityTrend = 'declining';
  else this.velocityTrend = 'stable';
};

module.exports = mongoose.model('TrendScore', trendScoreSchema, 'trendscores');
