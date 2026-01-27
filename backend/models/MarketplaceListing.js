const mongoose = require('mongoose');

// Review sub-schema
const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  helpful: {
    type: Number,
    default: 0
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  }]
});

const marketplaceListingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  tagline: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  appUrl: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String,
    trim: true
  }],
  thumbnail: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['productivity', 'dev-tools', 'marketing', 'finance', 'design', 'ai-ml', 'e-commerce', 'education', 'other']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  upvotes: {
    type: Number,
    default: 0
  },
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  }],
  upvoteHistory: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    timestamp: { type: Date, default: Date.now }
  }],
  views: {
    type: Number,
    default: 0
  },
  reviews: [reviewSchema],
  averageRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' // Auto-approve for now, can add moderation later
  }
}, {
  timestamps: true
});

// Index for search
marketplaceListingSchema.index({ name: 'text', tagline: 'text', description: 'text' });

// Index for category filtering
marketplaceListingSchema.index({ category: 1 });

// Index for sorting by date
marketplaceListingSchema.index({ createdAt: -1 });

// Index for sorting by upvotes (hall of fame)
marketplaceListingSchema.index({ upvotes: -1 });

// Index for status filtering (most queries filter by approved status)
marketplaceListingSchema.index({ status: 1 });

// Compound index for common queries
marketplaceListingSchema.index({ status: 1, createdAt: -1 });
marketplaceListingSchema.index({ status: 1, upvotes: -1 });
marketplaceListingSchema.index({ status: 1, category: 1, createdAt: -1 });

// Index for user's own listings (My Listings in settings)
marketplaceListingSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema, 'marketplacelistings');
