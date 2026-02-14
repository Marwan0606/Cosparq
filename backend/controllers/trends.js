/**
 * Trend Map Controller
 * Handles API endpoints for the AI Market Trend Map feature
 */

const TrendPost = require('../models/TrendPost');
const TrendScore = require('../models/TrendScore');
const MapRegion = require('../models/MapRegion');
const { runTrendPipeline, runQuickPipeline, getStatus, getStats } = require('../services/trendCron');
const { CATEGORIES } = require('../services/trendAnalyzer');

/**
 * GET /api/trends/map
 * Get all trend data formatted for map visualization
 */
const getMapData = async (req, res) => {
  try {
    // Get all trend scores
    const trends = await TrendScore.find({})
      .sort({ weightedScore: -1 });
    
    // Get map regions
    let regions = await MapRegion.find({ isActive: true });
    
    // Initialize default regions if none exist
    if (regions.length === 0) {
      const defaults = MapRegion.getDefaultRegions();
      await MapRegion.insertMany(defaults);
      regions = await MapRegion.find({ isActive: true });
    }
    
    // Format for visualization
    const mapData = {
      trends: trends.map(t => ({
        category: t.category,
        displayName: t.displayName || formatCategoryName(t.category),
        score: t.weightedScore,
        mentions: t.mentionCount,
        velocity: t.velocity,
        velocityTrend: t.velocityTrend,
        position: t.mapPosition || assignPosition(t.category, regions),
        color: t.color || getColorForScore(t.weightedScore),
        topPainPoints: t.topPainPoints?.slice(0, 5) || [],
        relatedTopics: t.relatedTopics?.slice(0, 8) || []
      })),
      regions: regions.map(r => ({
        name: r.name,
        slug: r.slug,
        boundaries: r.boundaries,
        center: r.center,
        color: r.color
      })),
      meta: {
        lastUpdated: trends[0]?.lastUpdated || new Date(),
        totalCategories: trends.length,
        totalMentions: trends.reduce((sum, t) => sum + t.mentionCount, 0)
      }
    };
    
    res.json(mapData);
  } catch (error) {
    console.error('[Trends] Error getting map data:', error);
    res.status(500).json({ error: 'Failed to get map data' });
  }
};

/**
 * GET /api/trends/category/:category
 * Get detailed data for a specific category
 */
const getCategoryDetail = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Get trend score
    const trend = await TrendScore.findOne({ category });
    if (!trend) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get recent posts in this category
    const recentPosts = await TrendPost.find({ 
      category,
      processed: true 
    })
      .sort({ upvotes: -1 })
      .limit(20)
      .select('title url source subreddit upvotes comments topics painPoints sourceCreatedAt');
    
    // Get historical data
    const history = trend.dailyScores?.slice(-30) || [];
    
    res.json({
      category: trend.category,
      displayName: trend.displayName || formatCategoryName(trend.category),
      score: trend.weightedScore,
      mentions: trend.mentionCount,
      velocity: trend.velocity,
      velocityTrend: trend.velocityTrend,
      topPainPoints: trend.topPainPoints || [],
      relatedTopics: trend.relatedTopics || [],
      recentPosts,
      history
    });
  } catch (error) {
    console.error('[Trends] Error getting category detail:', error);
    res.status(500).json({ error: 'Failed to get category detail' });
  }
};

/**
 * GET /api/trends/pain-points
 * Get top pain points across all categories
 */
const getTopPainPoints = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Aggregate pain points from all processed posts
    const painPoints = await TrendPost.aggregate([
      { $match: { processed: true } },
      { $unwind: '$painPoints' },
      { 
        $group: { 
          _id: '$painPoints',
          count: { $sum: 1 },
          avgDemand: { $avg: '$demandSignal' },
          categories: { $addToSet: '$category' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({
      painPoints: painPoints.map(p => ({
        painPoint: p._id,
        mentions: p.count,
        avgDemandSignal: Math.round(p.avgDemand),
        categories: p.categories.filter(Boolean)
      }))
    });
  } catch (error) {
    console.error('[Trends] Error getting pain points:', error);
    res.status(500).json({ error: 'Failed to get pain points' });
  }
};

/**
 * GET /api/trends/topics
 * Get trending topics
 */
const getTrendingTopics = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const topics = await TrendPost.aggregate([
      { $match: { processed: true } },
      { $unwind: '$topics' },
      { 
        $group: { 
          _id: '$topics',
          count: { $sum: 1 },
          totalUpvotes: { $sum: '$upvotes' },
          categories: { $addToSet: '$category' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({
      topics: topics.map(t => ({
        topic: t._id,
        mentions: t.count,
        engagement: t.totalUpvotes,
        categories: t.categories.filter(Boolean)
      }))
    });
  } catch (error) {
    console.error('[Trends] Error getting topics:', error);
    res.status(500).json({ error: 'Failed to get topics' });
  }
};

/**
 * GET /api/trends/suggestions
 * Get AI-powered startup idea suggestions based on trends
 */
const getStartupSuggestions = async (req, res) => {
  try {
    // Get top pain points with high demand signal
    const highDemandPainPoints = await TrendPost.aggregate([
      { 
        $match: { 
          processed: true,
          demandSignal: { $gte: 70 }
        } 
      },
      { $unwind: '$painPoints' },
      { 
        $group: { 
          _id: '$painPoints',
          avgDemand: { $avg: '$demandSignal' },
          count: { $sum: 1 },
          categories: { $addToSet: '$category' },
          samplePosts: { $push: { title: '$title', url: '$url' } }
        } 
      },
      { $match: { count: { $gte: 3 } } },
      { $sort: { avgDemand: -1 } },
      { $limit: 20 }
    ]);
    
    // Get fastest growing categories
    const growingCategories = await TrendScore.find({ velocity: { $gt: 0 } })
      .sort({ velocity: -1 })
      .limit(5);
    
    res.json({
      highDemandProblems: highDemandPainPoints.map(p => ({
        problem: p._id,
        demandSignal: Math.round(p.avgDemand),
        mentions: p.count,
        categories: p.categories.filter(Boolean),
        evidence: p.samplePosts.slice(0, 3)
      })),
      growingMarkets: growingCategories.map(c => ({
        category: c.category,
        displayName: c.displayName || formatCategoryName(c.category),
        velocity: c.velocity,
        topPainPoints: c.topPainPoints?.slice(0, 3) || []
      }))
    });
  } catch (error) {
    console.error('[Trends] Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

/**
 * GET /api/trends/search
 * Search for specific topics or keywords
 */
const searchTrends = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    const posts = await TrendPost.find({
      $text: { $search: q }
    })
      .sort({ score: { $meta: 'textScore' }, upvotes: -1 })
      .limit(parseInt(limit))
      .select('title url source subreddit category topics painPoints upvotes comments sourceCreatedAt');
    
    res.json({
      query: q,
      results: posts,
      count: posts.length
    });
  } catch (error) {
    console.error('[Trends] Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * GET /api/trends/stats
 * Get overall statistics
 */
const getTrendStats = async (req, res) => {
  try {
    const stats = await getStats();
    const status = getStatus();
    
    res.json({
      ...stats,
      pipeline: {
        isRunning: status.isRunning,
        lastRunAt: status.lastRunAt,
        lastRunDuration: status.lastRunResult?.duration
      }
    });
  } catch (error) {
    console.error('[Trends] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

/**
 * POST /api/trends/run
 * Manually trigger the trend pipeline (admin only)
 */
const triggerPipeline = async (req, res) => {
  try {
    const { quick = false } = req.body;
    
    // Start pipeline in background
    const pipelinePromise = quick ? runQuickPipeline() : runTrendPipeline();
    
    // Don't wait for completion
    pipelinePromise.then(result => {
      console.log('[Trends] Manual pipeline complete:', result);
    }).catch(err => {
      console.error('[Trends] Manual pipeline failed:', err);
    });
    
    res.json({ 
      message: `${quick ? 'Quick' : 'Full'} pipeline started`,
      status: 'running'
    });
  } catch (error) {
    console.error('[Trends] Error triggering pipeline:', error);
    res.status(500).json({ error: 'Failed to trigger pipeline' });
  }
};

/**
 * POST /api/trends/chat
 * Chat with AI about trend data
 */
const chatAboutTrends = async (req, res) => {
  try {
    const { message, context } = req.body;
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Get trend data for context
    const trends = await TrendScore.find({}).sort({ weightedScore: -1 }).limit(10);
    
    // Build context
    let trendContext = 'MARKET TREND DATA FROM HACKER NEWS:\n\n';
    trends.forEach(t => {
      trendContext += `Category: ${t.displayName || t.category}\n`;
      trendContext += `- Score: ${t.weightedScore}, Mentions: ${t.mentionCount}\n`;
      if (t.topPainPoints?.length) {
        trendContext += `- Pain Points: ${t.topPainPoints.slice(0, 3).map(p => p.painPoint || p).join(', ')}\n`;
      }
      if (t.relatedTopics?.length) {
        trendContext += `- Topics: ${t.relatedTopics.slice(0, 5).map(t => t.topic || t).join(', ')}\n`;
      }
      trendContext += '\n';
    });

    // Get top pain points
    const painPoints = await TrendPost.aggregate([
      { $match: { processed: true } },
      { $unwind: '$painPoints' },
      { $group: { _id: '$painPoints', count: { $sum: 1 }, avgDemand: { $avg: '$demandSignal' } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    trendContext += 'TOP PAIN POINTS (problems people are facing):\n';
    painPoints.forEach(p => {
      trendContext += `- "${p._id}" (${p.count} mentions, demand: ${Math.round(p.avgDemand)}/100)\n`;
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a market trend analyst helping a startup founder understand market opportunities. 
You have access to real data scraped from Hacker News about what developers and entrepreneurs are discussing.
Be specific and actionable. When suggesting startup ideas, base them on the actual pain points in the data.
Keep responses concise but insightful.`
        },
        {
          role: 'user',
          content: `Here's the current market trend data:\n\n${trendContext}\n\n${context || ''}\n\nUser question: ${message}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    res.json({
      response: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('[Trends] Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat: ' + error.message });
  }
};

/**
 * Helper: Format category slug to display name
 */
function formatCategoryName(slug) {
  const nameMap = {
    'ai-ml': 'AI & Machine Learning',
    'saas': 'SaaS',
    'devtools': 'Developer Tools',
    'automation': 'Automation',
    'fintech': 'FinTech',
    'healthtech': 'HealthTech',
    'edtech': 'EdTech',
    'ecommerce': 'E-Commerce',
    'creator-tools': 'Creator Tools',
    'productivity': 'Productivity',
    'social': 'Social & Community',
    'nocode': 'No-Code',
    'mobile': 'Mobile Apps',
    'security': 'Security & Privacy',
    'data': 'Data & Analytics',
    'other': 'Other'
  };
  return nameMap[slug] || slug;
}

/**
 * Helper: Assign position based on category
 */
function assignPosition(category, regions) {
  // Simple algorithm to spread categories across regions
  const categoryRegionMap = {
    'ai-ml': 'ai-ml',
    'data': 'ai-ml',
    'automation': 'ai-ml',
    'saas': 'saas-business',
    'fintech': 'saas-business',
    'ecommerce': 'saas-business',
    'devtools': 'devtools',
    'security': 'devtools',
    'nocode': 'devtools',
    'creator-tools': 'creator-consumer',
    'social': 'creator-consumer',
    'mobile': 'creator-consumer',
    'productivity': 'saas-business',
    'healthtech': 'saas-business',
    'edtech': 'creator-consumer'
  };
  
  const regionSlug = categoryRegionMap[category] || 'saas-business';
  const region = regions.find(r => r.slug === regionSlug);
  
  if (region?.center) {
    // Add some randomness to spread within region
    return {
      x: region.center.x + (Math.random() - 0.5) * 15,
      y: region.center.y + (Math.random() - 0.5) * 15
    };
  }
  
  return { x: 50, y: 50 };
}

/**
 * Helper: Get color based on score
 */
function getColorForScore(score) {
  if (score > 5000) return '#ef4444'; // Red - very hot
  if (score > 2000) return '#f97316'; // Orange - hot
  if (score > 1000) return '#eab308'; // Yellow - warm
  if (score > 500) return '#22c55e';  // Green - growing
  return '#3b82f6';                    // Blue - normal
}

/**
 * GET /api/trends/export
 * Export all raw data for download
 */
const exportRawData = async (req, res) => {
  try {
    const { limit = 1000, format = 'json' } = req.query;
    
    // Get all posts
    const posts = await TrendPost.find({})
      .sort({ sourceCreatedAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    // Get trend scores
    const trends = await TrendScore.find({})
      .sort({ weightedScore: -1 })
      .lean();
    
    // Get stats
    const stats = {
      totalPosts: await TrendPost.countDocuments(),
      processedPosts: await TrendPost.countDocuments({ processed: true }),
      unprocessedPosts: await TrendPost.countDocuments({ processed: false }),
      sources: await TrendPost.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      categories: await TrendPost.aggregate([
        { $match: { processed: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    };
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      stats,
      posts: posts.map(p => ({
        id: p._id,
        source: p.source,
        sourceId: p.sourceId,
        subreddit: p.subreddit,
        title: p.title,
        content: p.content?.slice(0, 500), // Truncate long content
        url: p.url,
        author: p.author,
        upvotes: p.upvotes,
        comments: p.comments,
        category: p.category,
        topics: p.topics,
        painPoints: p.painPoints,
        demandSignal: p.demandSignal,
        processed: p.processed,
        sourceCreatedAt: p.sourceCreatedAt,
        fetchedAt: p.fetchedAt
      })),
      trends: trends.map(t => ({
        category: t.category,
        displayName: t.displayName,
        score: t.weightedScore,
        mentions: t.mentionCount,
        velocity: t.velocity,
        topPainPoints: t.topPainPoints,
        relatedTopics: t.relatedTopics
      }))
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('[Trends] Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

module.exports = {
  getMapData,
  getCategoryDetail,
  getTopPainPoints,
  getTrendingTopics,
  getStartupSuggestions,
  searchTrends,
  getTrendStats,
  triggerPipeline,
  chatAboutTrends,
  exportRawData
};
