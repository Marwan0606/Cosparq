const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  email: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
    unique:true,
    lowercase:true
  },
  password: {
    type:String,
    required:[true, 'must provide rating']
  },
  name: {
    type:String,
    required:[true, 'must provide name']
  },
  displayName: {
    type: String,
    trim: true,
  },
  numberPrompts: {
    type:String,
    default: 0,
  },
  projectCount: {
    type: Number,
    default: 0,
  },
  // Subscription Plan
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free',
  },
  // Stripe Integration
  stripeCustomerId: {
    type: String,
    sparse: true, // Allows null/undefined while still being indexable
  },
  stripeSubscriptionId: {
    type: String,
    sparse: true,
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid', null],
    default: null,
  },
  subscriptionPeriodEnd: {
    type: Date,
    default: null,
  },
  // Timestamp of last Stripe verification (for cache invalidation)
  subscriptionLastChecked: {
    type: Date,
    default: null,
  },
  // Audit trail for subscription changes (security)
  subscriptionHistory: [{
    timestamp: {
      type: Date,
      default: Date.now,
    },
    action: String, // 'created', 'upgraded', 'downgraded', 'canceled', 'renewed'
    fromPlan: String,
    toPlan: String,
    stripeEventId: String, // For idempotency and audit
  }],
  // API Usage Tracking
  totalApiRequests: {
    type: Number,
    default: 0,
  },
  totalApiCost: {
    type: Number, // Cost in USD
    default: 0,
  },
  apiUsageHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    endpoint: String, // Which controller/feature made the call
    model: String, // Which OpenAI model was used
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number,
    cost: Number // Cost of this specific request in USD
  }],
  
  // Password Reset
  passwordResetToken: {
    type: String,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  
  // Email Notification Preferences
  notificationPreferences: {
    productUpdates: {
      type: Boolean,
      default: true,
    },
    usageAlerts: {
      type: Boolean,
      default: true,
    },
    weeklySummary: {
      type: Boolean,
      default: false,
    },
    marketing: {
      type: Boolean,
      default: false,
    },
  },
  
  // Marketplace Autofills (one AI generation per idea)
  marketplaceAutofills: [{
    ideaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
    },
    data: {
      name: String,
      tagline: String,
      description: String,
      category: String,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Legacy field - kept for backward compatibility
  marketplaceAutofill: {
    generated: {
      type: Boolean,
      default: false,
    },
    data: {
      name: String,
      tagline: String,
      description: String,
      category: String,
      ideaId: String,
    },
    generatedAt: Date,
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
})

module.exports = mongoose.model('Users', UserSchema);