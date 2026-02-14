const mongoose = require('mongoose');

/**
 * MapRegion Model
 * Defines regions on the trend map where categories are clustered
 * AI can dynamically adjust regions based on emerging trends
 */
const mapRegionSchema = new mongoose.Schema({
  // Region identification
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Visual styling
  color: {
    type: String,
    default: '#8B5CF6'
  },
  gradientFrom: {
    type: String
  },
  gradientTo: {
    type: String
  },
  icon: {
    type: String // emoji or icon name
  },
  
  // Region boundaries (polygon coordinates)
  // Coordinates are 0-100 representing percentage of map
  boundaries: [{
    x: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    y: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  
  // Center point for label placement
  center: {
    x: {
      type: Number,
      default: 50
    },
    y: {
      type: Number,
      default: 50
    }
  },
  
  // Categories that belong to this region
  categories: [{
    type: String,
    lowercase: true
  }],
  
  // Keywords that map posts to this region
  keywords: [{
    type: String,
    lowercase: true
  }],
  
  // Aggregated stats for this region
  totalMentions: {
    type: Number,
    default: 0
  },
  avgVelocity: {
    type: Number,
    default: 0
  },
  topCategory: {
    type: String
  },
  
  // Display order (lower = rendered first/behind)
  zIndex: {
    type: Number,
    default: 0
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for active regions
mapRegionSchema.index({ isActive: 1, zIndex: 1 });

// Static method to get default regions
mapRegionSchema.statics.getDefaultRegions = function() {
  return [
    {
      name: 'AI & Machine Learning',
      slug: 'ai-ml',
      description: 'Artificial intelligence, machine learning, LLMs, and automation',
      color: '#8B5CF6',
      icon: '🤖',
      center: { x: 20, y: 25 },
      boundaries: [
        { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 50 }, { x: 0, y: 50 }
      ],
      keywords: ['ai', 'ml', 'llm', 'gpt', 'machine learning', 'neural', 'deep learning', 'nlp', 'computer vision', 'agentic', 'agents', 'rag', 'embeddings'],
      zIndex: 1
    },
    {
      name: 'SaaS & Business',
      slug: 'saas-business',
      description: 'Software as a service, B2B tools, business automation',
      color: '#3B82F6',
      icon: '💼',
      center: { x: 70, y: 25 },
      boundaries: [
        { x: 40, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 40, y: 50 }
      ],
      keywords: ['saas', 'b2b', 'crm', 'erp', 'subscription', 'enterprise', 'analytics', 'dashboard', 'reporting'],
      zIndex: 1
    },
    {
      name: 'Developer Tools',
      slug: 'devtools',
      description: 'Tools for developers, APIs, infrastructure, DevOps',
      color: '#10B981',
      icon: '⚡',
      center: { x: 20, y: 75 },
      boundaries: [
        { x: 0, y: 50 }, { x: 40, y: 50 }, { x: 40, y: 100 }, { x: 0, y: 100 }
      ],
      keywords: ['api', 'sdk', 'cli', 'devtools', 'infrastructure', 'devops', 'ci/cd', 'testing', 'debugging', 'ide', 'code'],
      zIndex: 1
    },
    {
      name: 'Creator & Consumer',
      slug: 'creator-consumer',
      description: 'Creator tools, social apps, consumer products, marketplaces',
      color: '#F59E0B',
      icon: '🎨',
      center: { x: 70, y: 75 },
      boundaries: [
        { x: 40, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }, { x: 40, y: 100 }
      ],
      keywords: ['creator', 'social', 'marketplace', 'e-commerce', 'content', 'video', 'audio', 'newsletter', 'community', 'monetization'],
      zIndex: 1
    }
  ];
};

// Method to check if a point is inside this region
mapRegionSchema.methods.containsPoint = function(x, y) {
  const bounds = this.boundaries;
  if (bounds.length < 3) return false;
  
  // Ray casting algorithm
  let inside = false;
  for (let i = 0, j = bounds.length - 1; i < bounds.length; j = i++) {
    const xi = bounds[i].x, yi = bounds[i].y;
    const xj = bounds[j].x, yj = bounds[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

module.exports = mongoose.model('MapRegion', mapRegionSchema, 'mapregions');
