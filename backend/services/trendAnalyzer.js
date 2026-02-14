/**
 * AI Trend Analyzer Service v2
 * 
 * Two-pass analysis pipeline:
 * 1. Pre-filter: Remove irrelevant posts using fast keyword checks + engagement thresholds
 * 2. Pass 1 (Relevance Gate): Quick AI check — "Is this about a real market need?" (cheap)
 * 3. Pass 2 (Deep Analysis): Full extraction of topics, pain points, demand signal (only on relevant posts)
 * 
 * This dramatically reduces AI spend and improves data quality.
 */

const OpenAI = require('openai');
const TrendPost = require('../models/TrendPost');
const TrendScore = require('../models/TrendScore');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ──────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────
const BATCH_SIZE = 5;  // Posts per deep analysis API call (set low for testing)
const RELEVANCE_BATCH_SIZE = 10; // Posts per relevance check
const MODEL = 'gpt-4o-mini';

// Expanded categories — matches what actually shows up in the data
const CATEGORIES = [
  'ai-ml',           // AI/ML tools and applications
  'saas',            // SaaS products and businesses
  'devtools',        // Developer tools and infrastructure
  'automation',      // Workflow automation
  'fintech',         // Finance and payments
  'healthtech',      // Health and wellness
  'edtech',          // Education and learning
  'ecommerce',       // E-commerce and marketplaces
  'creator-tools',   // Creator economy (video, music, art, writing)
  'productivity',    // Productivity & project management
  'social',          // Social platforms and community tools
  'nocode',          // No-code/low-code platforms
  'mobile',          // Mobile apps
  'security',        // Cybersecurity and privacy
  'data',            // Data analytics and visualization
  'marketing',       // Digital marketing, SEO, ads
  'remote-work',     // Remote work tools, freelancing
  'gaming',          // Gaming tools, platforms, communities
  'hr-recruiting',   // Hiring, HR tech
  'legal',           // Legal tech
  'real-estate',     // PropTech
  'sustainability',  // Green tech, climate
  'api-infra',       // APIs, cloud, infrastructure
];

const DISPLAY_NAMES = {
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
  'nocode': 'No-Code / Low-Code',
  'mobile': 'Mobile Apps',
  'security': 'Cybersecurity & Privacy',
  'data': 'Data & Analytics',
  'marketing': 'Marketing & Growth',
  'remote-work': 'Remote Work & Freelancing',
  'gaming': 'Gaming',
  'hr-recruiting': 'HR & Recruiting',
  'legal': 'Legal Tech',
  'real-estate': 'Real Estate Tech',
  'sustainability': 'Green & Climate Tech',
  'api-infra': 'APIs & Infrastructure',
};

// Minimum engagement thresholds — posts below these are not worth analyzing
const MIN_UPVOTES_REDDIT = 3;
const MIN_UPVOTES_HN = 5;
const MIN_UPVOTES_TWITTER = 2;

// ──────────────────────────────────────────────
// STEP 0: PRE-FILTER (no AI, just logic)
// ──────────────────────────────────────────────

// Subreddits that should NEVER produce relevant data
const BLOCKED_SUBREDDITS = new Set([
  'bestofreddit', 'bestofredditorupdates', 'askreddit', 'relationships',
  'relationship_advice', 'amitheasshole', 'tifu', 'unpopularopinion',
  'showerthoughts', 'explainlikeimfive', 'todayilearned', 'memes',
  'funny', 'pics', 'gaming', 'movies', 'television', 'music',
  'food', 'aww', 'worldnews', 'politics', 'news'
]);

// Words that strongly indicate irrelevant content
const IRRELEVANT_SIGNALS = [
  'my girlfriend', 'my boyfriend', 'my husband', 'my wife',
  'my ex', 'breakup', 'cheating', 'divorce',
  'aita', 'am i the', 'aitah',
  'meme', 'shitpost', 'clickbait',
  'nsfw', 'gone wild', 'onlyfans',
];

// Words that strongly indicate relevant content (startup / market / product)
const RELEVANT_SIGNALS = [
  'startup', 'saas', 'mvp', 'launched', 'building', 'built',
  'side project', 'pain point', 'problem', 'solution', 'tool',
  'app', 'platform', 'product', 'customer', 'user',
  'pricing', 'revenue', 'monetiz', 'subscription', 'freemium',
  'api', 'sdk', 'open source', 'framework',
  'wish there was', 'need a tool', 'looking for', 'frustrated',
  'automate', 'workflow', 'integration',
  'ai', 'machine learning', 'llm', 'gpt', 'chatbot',
  'no-code', 'low-code', 'self-hosted',
  'market', 'demand', 'competitor', 'niche', 'growth',
  'b2b', 'b2c', 'enterprise', 'smb',
  'feedback', 'review', 'comparison',
  'show hn', 'ask hn', 'launch hn',
];

/**
 * Fast pre-filter — no AI calls, pure logic
 * Returns: { dominated: true/false, reason }
 */
function preFilterPost(post) {
  // Auto fast-track curated sources — these are product directories,
  // every post is a real product/startup launch, no noise filtering needed
  const CURATED_SOURCES = new Set(['producthunt', 'taaft', 'betalist', 'github']);
  if (CURATED_SOURCES.has(post.source)) {
    return { dominated: false, fastTrack: true, reason: 'curated_source' };
  }

  // Block known-bad subreddits
  if (post.subreddit && BLOCKED_SUBREDDITS.has(post.subreddit.toLowerCase())) {
    return { dominated: true, reason: 'blocked_subreddit' };
  }
  
  // Minimum engagement check
  const minUpvotes = post.source === 'hackernews' ? MIN_UPVOTES_HN 
                   : post.source === 'twitter' ? MIN_UPVOTES_TWITTER
                   : MIN_UPVOTES_REDDIT;
  if ((post.upvotes || 0) < minUpvotes) {
    return { dominated: true, reason: 'low_engagement' };
  }
  
  const text = `${post.title || ''} ${(post.content || '').slice(0, 300)}`.toLowerCase();
  
  // Check for irrelevant signals
  const hasIrrelevant = IRRELEVANT_SIGNALS.some(s => text.includes(s));
  if (hasIrrelevant) {
    return { dominated: true, reason: 'irrelevant_content' };
  }
  
  // Check for relevant signals — posts with these skip to deep analysis
  const hasRelevant = RELEVANT_SIGNALS.some(s => text.includes(s));
  if (hasRelevant) {
    return { dominated: false, fastTrack: true, reason: 'has_relevant_keywords' };
  }
  
  // No strong signal either way — will go through AI relevance gate
  return { dominated: false, fastTrack: false, reason: 'needs_ai_check' };
}

// ──────────────────────────────────────────────
// PASS 1: AI RELEVANCE GATE (cheap, fast)
// ──────────────────────────────────────────────

const RELEVANCE_PROMPT = `You are a startup market analyst filter. For each post, decide if it's relevant for identifying market trends, startup opportunities, or user pain points.

A post IS relevant if it:
- Discusses a problem people face (potential startup idea)
- Shows what tools/products people are building or looking for
- Reveals market demand, user frustrations, or gaps in existing solutions
- Is about technology trends, new products, or business models
- Comes from startup, tech, or business communities

A post is NOT relevant if it:
- Is personal drama, relationship advice, entertainment, memes
- Is general news with no actionable startup insight
- Is a joke, shitpost, or off-topic content
- Discusses politics, sports, or pop culture with no tech angle

Return ONLY a JSON array of objects with "index" (number) and "relevant" (boolean). No other text.`;

async function aiRelevanceFilter(posts) {
  const postsText = posts.map((p, i) => {
    return `[${i}] (${p.source}${p.subreddit ? ' r/' + p.subreddit : ''}) ${p.title || ''}${p.content ? ' — ' + p.content.slice(0, 150) : ''}`;
  }).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: RELEVANCE_PROMPT },
        { role: 'user', content: `Filter these ${posts.length} posts:\n\n${postsText}` }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content.trim();
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    
    const results = JSON.parse(jsonStr);
    return results;
  } catch (error) {
    console.error('[Analyzer] Relevance filter failed:', error.message);
    // On failure, pass everything through (don't lose data)
    return posts.map((_, i) => ({ index: i, relevant: true }));
  }
}

// ──────────────────────────────────────────────
// PASS 2: DEEP ANALYSIS (full extraction)
// ──────────────────────────────────────────────

const DEEP_ANALYSIS_PROMPT = `You are a startup market analyst. For each post, extract detailed market intelligence:

CATEGORIES (pick the BEST one, avoid "other" unless truly none fit):
${CATEGORIES.map(c => `${c} — ${DISPLAY_NAMES[c]}`).join('\n')}

For each post return:
1. topics: 2-5 specific topics (e.g. "AI code review", "invoice automation", NOT generic like "technology")
2. painPoints: 1-3 specific problems/frustrations mentioned. Be concrete (e.g. "manual invoice processing takes 2 hours" not "it's hard"). If no clear pain point, use empty array.
3. category: MUST be from the list above. Only use "other" as absolute last resort.
4. sentiment: positive / negative / neutral / mixed
5. demandSignal: 0-100. High = many people want this, clear market gap. Low = niche interest, solved problem.
6. relevanceScore: 0-100. How useful is this for someone looking for startup ideas?

Return ONLY valid JSON array, no markdown, no explanation.`;

async function deepAnalysisBatch(posts) {
  const postsText = posts.map((p, i) => {
    const engagement = `[👍${p.upvotes || 0} 💬${p.comments || 0}]`;
    const src = p.source + (p.subreddit ? ` r/${p.subreddit}` : '');
    return `--- Post ${i} ${engagement} (${src}) ---
Title: ${p.title || 'No title'}
${p.content ? 'Content: ' + p.content.slice(0, 600) : ''}`;
  }).join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: DEEP_ANALYSIS_PROMPT },
        { role: 'user', content: `Analyze these ${posts.length} posts:\n\n${postsText}\n\nReturn JSON array with objects containing: index, topics, painPoints, category, sentiment, demandSignal, relevanceScore` }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    const content = response.choices[0].message.content.trim();
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[Analyzer] Deep analysis failed:', error.message);
    return null;
  }
}

// ──────────────────────────────────────────────
// PIPELINE: Pre-filter → Pass 1 → Pass 2
// ──────────────────────────────────────────────

async function processUnprocessedPosts(options = {}) {
  const { limit = 15, batchSize = BATCH_SIZE } = options;
  
  console.log('[Analyzer] Starting two-pass analysis pipeline...');
  
  // Get unprocessed posts, prioritize by engagement
  const unprocessed = await TrendPost.find({ processed: false })
    .sort({ upvotes: -1 })
    .limit(limit);
  
  if (unprocessed.length === 0) {
    console.log('[Analyzer] No unprocessed posts found');
    return { processed: 0, filtered: 0, batches: 0 };
  }
  
  console.log(`[Analyzer] Found ${unprocessed.length} unprocessed posts`);
  
  // ─── STEP 0: Pre-filter (no AI) ───
  const fastTrackPosts = [];
  const needsAiCheck = [];
  let preFiltered = 0;
  
  for (const post of unprocessed) {
    const result = preFilterPost(post);
    if (result.dominated) {
      // Mark as processed but irrelevant
      await TrendPost.findByIdAndUpdate(post._id, {
        processed: true,
        processedAt: new Date(),
        relevanceScore: 0,
        demandSignal: 0,
        category: 'irrelevant',
        processingError: `pre-filtered: ${result.reason}`
      });
      preFiltered++;
    } else if (result.fastTrack) {
      fastTrackPosts.push(post);
    } else {
      needsAiCheck.push(post);
    }
  }
  
  console.log(`[Analyzer] Pre-filter: ${preFiltered} removed, ${fastTrackPosts.length} fast-tracked, ${needsAiCheck.length} need AI check`);
  
  // ─── PASS 1: AI Relevance Gate ───
  let aiFiltered = 0;
  const relevantPosts = [...fastTrackPosts]; // fast-tracked posts skip this
  
  for (let i = 0; i < needsAiCheck.length; i += RELEVANCE_BATCH_SIZE) {
    const batch = needsAiCheck.slice(i, i + RELEVANCE_BATCH_SIZE);
    console.log(`[Analyzer] Pass 1: Checking relevance of ${batch.length} posts...`);
    
    const results = await aiRelevanceFilter(batch);
    
    for (const result of results) {
      const post = batch[result.index];
      if (!post) continue;
      
      if (result.relevant) {
        relevantPosts.push(post);
      } else {
        await TrendPost.findByIdAndUpdate(post._id, {
          processed: true,
          processedAt: new Date(),
          relevanceScore: 0,
          demandSignal: 0,
          category: 'irrelevant',
          processingError: 'ai-filtered: not relevant'
        });
        aiFiltered++;
      }
    }
    
    if (i + RELEVANCE_BATCH_SIZE < needsAiCheck.length) {
      await sleep(500);
    }
  }
  
  console.log(`[Analyzer] Pass 1: ${aiFiltered} filtered by AI, ${relevantPosts.length} moving to deep analysis`);
  
  // ─── PASS 2: Deep Analysis ───
  let totalProcessed = 0;
  let batchCount = 0;
  
  for (let i = 0; i < relevantPosts.length; i += batchSize) {
    const batch = relevantPosts.slice(i, i + batchSize);
    batchCount++;
    
    console.log(`[Analyzer] Pass 2 batch ${batchCount}: Analyzing ${batch.length} posts...`);
    
    const analyses = await deepAnalysisBatch(batch);
    
    if (analyses) {
      for (const analysis of analyses) {
        const post = batch[analysis.index];
        if (!post) continue;
        
        try {
          // Validate category
          let category = analysis.category || 'other';
          if (!CATEGORIES.includes(category) && category !== 'irrelevant') {
            category = 'other';
          }
          
          await TrendPost.findByIdAndUpdate(post._id, {
            topics: analysis.topics || [],
            painPoints: analysis.painPoints || [],
            category,
            sentiment: analysis.sentiment || 'neutral',
            demandSignal: analysis.demandSignal || 50,
            relevanceScore: analysis.relevanceScore || 50,
            processed: true,
            processedAt: new Date()
          });
          totalProcessed++;
        } catch (error) {
          console.error(`[Analyzer] Failed to update post ${post._id}:`, error.message);
        }
      }
      console.log(`[Analyzer] Pass 2 batch ${batchCount}: ${analyses.length} analyzed`);
    } else {
      // Mark as processed to avoid infinite retry
      for (const post of batch) {
        await TrendPost.findByIdAndUpdate(post._id, {
          processed: true,
          processedAt: new Date(),
          processingError: 'deep analysis failed'
        });
      }
    }
    
    if (i + batchSize < relevantPosts.length) {
      await sleep(1000);
    }
  }
  
  const totalFiltered = preFiltered + aiFiltered;
  console.log(`[Analyzer] Pipeline complete: ${totalProcessed} analyzed, ${totalFiltered} filtered out (${preFiltered} pre-filter, ${aiFiltered} AI filter)`);
  
  return { processed: totalProcessed, filtered: totalFiltered, batches: batchCount };
}

// ──────────────────────────────────────────────
// AGGREGATION
// ──────────────────────────────────────────────

async function aggregateTrends() {
  console.log('[Analyzer] Aggregating trends from processed posts...');
  
  const now = new Date();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  
  // Aggregate by category, EXCLUDING irrelevant posts
  const categoryAggregation = await TrendPost.aggregate([
    {
      $match: {
        processed: true,
        category: { $ne: 'irrelevant', $ne: null },
        sourceCreatedAt: { $gte: fourteenDaysAgo }
      }
    },
    {
      $group: {
        _id: '$category',
        mentionCount: { $sum: 1 },
        totalUpvotes: { $sum: '$upvotes' },
        totalComments: { $sum: '$comments' },
        avgDemandSignal: { $avg: '$demandSignal' },
        avgRelevance: { $avg: '$relevanceScore' },
        allTopics: { $push: '$topics' },
        allPainPoints: { $push: '$painPoints' }
      }
    }
  ]);
  
  // Clear old scores for categories no longer present
  const activeCats = categoryAggregation.map(c => c._id).filter(Boolean);
  
  for (const cat of categoryAggregation) {
    const category = cat._id;
    if (!category || category === 'irrelevant' || category === 'other') continue;
    
    // Flatten and count topics
    const topicCounts = {};
    cat.allTopics.flat().forEach(topic => {
      if (topic && typeof topic === 'string') {
        const t = topic.toLowerCase().trim();
        if (t.length > 2) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
      }
    });
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic, count]) => ({ topic, count }));
    
    // Flatten and count pain points
    const painCounts = {};
    cat.allPainPoints.flat().forEach(pain => {
      if (pain && typeof pain === 'string') {
        const p = pain.trim();
        if (p.length > 5) {
          painCounts[p] = (painCounts[p] || 0) + 1;
        }
      }
    });
    const topPainPoints = Object.entries(painCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([painPoint, mentions]) => ({ painPoint, mentions }));
    
    // Weighted score — favors demand signal and relevance over raw upvote count
    const weightedScore = Math.round(
      (cat.mentionCount * 5) +
      (Math.min(cat.totalUpvotes, 5000) * 0.1) +   // Cap upvote influence
      (cat.totalComments * 0.2) +
      (cat.avgDemandSignal * 15) +
      (cat.avgRelevance * 5)
    );
    
    await TrendScore.findOneAndUpdate(
      { category },
      {
        $set: {
          displayName: DISPLAY_NAMES[category] || category,
          mentionCount: cat.mentionCount,
          weightedScore,
          lastUpdated: now,
          relatedTopics: topTopics,
          topPainPoints: topPainPoints
        },
        $push: {
          dailyScores: {
            $each: [{ date: now, score: weightedScore, mentions: cat.mentionCount }],
            $slice: -90
          }
        }
      },
      { upsert: true, new: true }
    );
    
    console.log(`[Analyzer] Updated ${category}: ${cat.mentionCount} mentions, score ${weightedScore}, ${topPainPoints.length} pain points`);
  }
  
  // Calculate velocity
  await calculateAllVelocities();
  
  console.log('[Analyzer] Trend aggregation complete');
  return categoryAggregation.length;
}

async function calculateAllVelocities() {
  const trends = await TrendScore.find({});
  for (const trend of trends) {
    trend.calculateVelocity();
    await trend.save();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Full analysis pipeline
 */
async function runFullAnalysis() {
  console.log('[Analyzer] Running full analysis pipeline...');
  
  const { processed, filtered, batches } = await processUnprocessedPosts();
  const categories = await aggregateTrends();
  
  console.log(`[Analyzer] Pipeline complete: ${processed} posts analyzed, ${filtered} filtered, ${categories} categories`);
  return { processed, filtered, batches, categories };
}

module.exports = {
  processUnprocessedPosts,
  aggregateTrends,
  runFullAnalysis,
  preFilterPost,
  CATEGORIES,
  DISPLAY_NAMES
};
