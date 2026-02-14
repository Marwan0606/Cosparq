/**
 * Reddit Scraper Service v2
 * 
 * Improvements over v1:
 * - Tightened subreddit list (removed noisy subs, added high-signal ones)
 * - Scrapes TOP COMMENTS for pain-point gold
 * - Minimum engagement threshold (skip low-signal posts)
 * - OAuth2 support for higher rate limits
 * 
 * Setup:
 * 1. Go to https://www.reddit.com/prefs/apps
 * 2. Create a "script" type app, redirect URI: http://localhost:5004
 * 3. Add to .env: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 */

const TrendPost = require('../../models/TrendPost');

// ──────────────────────────────────────────────
// SUBREDDITS — curated for startup/market signal
// ──────────────────────────────────────────────

const SUBREDDITS = {
  // 🥇 TIER 1: Direct startup/product discussion (highest signal)
  tier1: [
    'startups',
    'SideProject',
    'indiehackers',
    'SaaS',
    'Entrepreneur',
    'SomebodyMakeThis',     // Pure gold: "I wish someone would build..."
    'AppIdeas',              // Direct startup ideas
    'InternetIsBeautiful',   // Showcases interesting web products
    'selfhosted',            // People building alternatives to commercial software
    'Business_Ideas',
  ],
  
  // 🥈 TIER 2: Tech communities where problems surface
  tier2: [
    'webdev',
    'reactjs',
    'node',
    'nextjs',
    'artificial',
    'MachineLearning',
    'LocalLLaMA',
    'ChatGPT',
    'devops',
    'nocode',
    'automation',
  ],
  
  // 🥉 TIER 3: Domain-specific (pain points in verticals)
  tier3: [
    'smallbusiness',
    'ecommerce',
    'marketing',
    'SEO',
    'freelance',
    'digitalnomad',
    'fintech',
    'healthIT',
    'edtech',
    'gamedev',
    'legaltech',
    'analytics',
    'remotework',
  ],
};

// Flatten all tiers
const ALL_SUBREDDITS = [...SUBREDDITS.tier1, ...SUBREDDITS.tier2, ...SUBREDDITS.tier3];

// ──────────────────────────────────────────────
// SEARCH QUERIES — find pain points across Reddit
// ──────────────────────────────────────────────

const PAIN_POINT_SEARCHES = [
  // Direct pain expressions
  '"I wish there was"',
  '"I need a tool"',
  '"looking for a solution"',
  '"why is it so hard to"',
  '"frustrated with"',
  '"hate how"',
  '"anyone know a tool"',
  '"is there an app"',
  '"does anyone know of"',
  '"alternative to"',
  
  // Building/launching
  '"just launched"',
  '"built this"',
  '"I made a"',
  '#buildinpublic',
  '"MVP feedback"',
  '"side project"',
  
  // Market signals
  '"would pay for"',
  '"shut up and take my money"',
  '"take my money"',
  '"biggest pain point"',
  '"underserved market"',
  '"gap in the market"',
];

// Minimum upvotes to bother saving
const MIN_UPVOTES = 3;

// ──────────────────────────────────────────────
// OAUTH
// ──────────────────────────────────────────────

let accessToken = null;
let tokenExpiry = null;
const DELAY_BETWEEN_REQUESTS = 1000;

async function getAccessToken() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  
  if (!clientId || !clientSecret) {
    return null;
  }
  
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    let body = username && password
      ? `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
      : 'grant_type=client_credentials';
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TrendAnalyzer/2.0'
      },
      body
    });
    
    if (!response.ok) throw new Error(`OAuth failed: ${response.status}`);
    
    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    console.log('[Reddit] OAuth token obtained');
    return accessToken;
  } catch (error) {
    console.error('[Reddit] OAuth error:', error.message);
    return null;
  }
}

async function redditRequest(endpoint, params = {}) {
  const token = await getAccessToken();
  const queryString = new URLSearchParams(params).toString();
  const url = token 
    ? `https://oauth.reddit.com${endpoint}${queryString ? '?' + queryString : ''}`
    : `https://www.reddit.com${endpoint}.json${queryString ? '?' + queryString : ''}`;
  
  const headers = { 'User-Agent': 'TrendAnalyzer/2.0 by /u/trendanalyzer' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    if (response.status === 401) { accessToken = null; tokenExpiry = null; }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────
// FETCHING
// ──────────────────────────────────────────────

async function fetchSubreddit(subreddit, sort = 'hot', limit = 100, after = null) {
  try {
    const params = { limit, raw_json: 1, t: 'week' };
    if (after) params.after = after;
    const data = await redditRequest(`/r/${subreddit}/${sort}`, params);
    return { posts: data.data?.children || [], after: data.data?.after };
  } catch (error) {
    if (!error.message.includes('403')) {
      console.error(`[Reddit] Error fetching r/${subreddit}:`, error.message);
    }
    return { posts: [], after: null };
  }
}

/**
 * Fetch top comments from a post (THE GOLD MINE for pain points)
 */
async function fetchTopComments(subreddit, postId, limit = 10) {
  try {
    const data = await redditRequest(`/r/${subreddit}/comments/${postId}`, {
      limit,
      depth: 1,
      sort: 'best',
      raw_json: 1
    });
    
    if (!Array.isArray(data) || data.length < 2) return [];
    
    const comments = data[1]?.data?.children || [];
    return comments
      .filter(c => c.kind === 't1' && c.data.body && c.data.body !== '[deleted]')
      .map(c => ({
        body: c.data.body.slice(0, 500),
        score: c.data.score || 0,
        author: c.data.author
      }))
      .filter(c => c.score >= 3) // Only comments with some agreement
      .slice(0, limit);
  } catch (error) {
    return [];
  }
}

async function searchReddit(query, options = {}) {
  const { sort = 'relevance', time = 'week', limit = 100 } = options;
  try {
    const data = await redditRequest('/search', {
      q: query, sort, t: time, limit, type: 'link', raw_json: 1, restrict_sr: false
    });
    return data.data?.children || [];
  } catch (error) {
    console.error(`[Reddit] Search error for "${query}":`, error.message);
    return [];
  }
}

// ──────────────────────────────────────────────
// TRANSFORM & SAVE
// ──────────────────────────────────────────────

function transformPost(post, subreddit, topComments = []) {
  const data = post.data;
  
  // Build enriched content with top comments
  let content = data.selftext || '';
  if (topComments.length > 0) {
    content += '\n\n--- TOP COMMENTS ---\n';
    content += topComments.map(c => `[${c.score}↑] ${c.body}`).join('\n\n');
  }
  
  return {
    source: 'reddit',
    sourceId: data.id,
    subreddit: subreddit || data.subreddit,
    title: data.title || '',
    content,
    url: data.url || `https://reddit.com${data.permalink}`,
    author: data.author || '[deleted]',
    upvotes: data.ups || 0,
    comments: data.num_comments || 0,
    sourceCreatedAt: new Date(data.created_utc * 1000),
    fetchedAt: new Date()
  };
}

async function savePosts(posts) {
  let saved = 0;
  let skipped = 0;
  
  for (const post of posts) {
    try {
      const result = await TrendPost.findOneAndUpdate(
        { source: post.source, sourceId: post.sourceId },
        { $setOnInsert: post },
        { upsert: true, new: true, rawResult: true }
      );
      if (result.lastErrorObject?.updatedExisting === false) {
        saved++;
      } else {
        skipped++;
      }
    } catch (error) {
      if (error.code !== 11000) console.error('[Reddit] Save error:', error.message);
      skipped++;
    }
  }
  
  return { saved, skipped };
}

// ──────────────────────────────────────────────
// MAIN SCRAPER
// ──────────────────────────────────────────────

async function scrapeReddit(options = {}) {
  const {
    subreddits = ALL_SUBREDDITS,
    sorts = ['hot', 'top', 'new'],
    scrapeComments = true,
    maxPostsPerSub = 100,
  } = options;
  
  console.log(`[Reddit] Starting v2 scrape of ${subreddits.length} subreddits...`);
  await getAccessToken();
  
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;
  let totalErrors = 0;
  
  // ─── Phase 1: Subreddit scraping ───
  for (const subreddit of subreddits) {
    for (const sort of sorts) {
      try {
        const { posts } = await fetchSubreddit(subreddit, sort, maxPostsPerSub);
        
        if (posts.length === 0) continue;
        
        // Filter: recent (14 days) and minimum engagement
        const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const qualityPosts = posts.filter(p => {
          const d = p.data;
          const isRecent = (d.created_utc * 1000) > twoWeeksAgo;
          const hasEngagement = (d.ups || 0) >= MIN_UPVOTES;
          return isRecent && hasEngagement;
        });
        
        totalFiltered += posts.length - qualityPosts.length;
        
        // For high-engagement posts, also fetch top comments
        const transformedPosts = [];
        for (const post of qualityPosts) {
          let topComments = [];
          
          if (scrapeComments && (post.data.num_comments || 0) >= 5 && (post.data.ups || 0) >= 10) {
            topComments = await fetchTopComments(subreddit, post.data.id, 5);
            if (topComments.length > 0) {
              await sleep(300); // Brief delay after comment fetch
            }
          }
          
          transformedPosts.push(transformPost(post, subreddit, topComments));
        }
        
        if (transformedPosts.length > 0) {
          const { saved, skipped } = await savePosts(transformedPosts);
          totalSaved += saved;
          totalSkipped += skipped;
          if (saved > 0) {
            console.log(`[Reddit] r/${subreddit}/${sort}: ${saved} new, ${skipped} existing (${totalFiltered} filtered)`);
          }
        }
        
      } catch (error) {
        if (!error.message.includes('403')) {
          console.error(`[Reddit] Failed r/${subreddit}/${sort}:`, error.message);
        }
        totalErrors++;
      }
      
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  // ─── Phase 2: Pain-point keyword searches ───
  console.log(`[Reddit] Phase 2: Searching ${PAIN_POINT_SEARCHES.length} pain-point queries...`);
  
  for (const query of PAIN_POINT_SEARCHES) {
    try {
      const results = await searchReddit(query, { time: 'month', limit: 100 });
      
      // Filter for quality
      const quality = results.filter(p => (p.data.ups || 0) >= MIN_UPVOTES);
      
      if (quality.length > 0) {
        const transformed = quality.map(p => transformPost(p, null));
        const { saved, skipped } = await savePosts(transformed);
        totalSaved += saved;
        totalSkipped += skipped;
        if (saved > 0) {
          console.log(`[Reddit] Search "${query}": ${saved} new, ${skipped} existing`);
        }
      }
      
      await sleep(DELAY_BETWEEN_REQUESTS * 2);
    } catch (error) {
      console.error(`[Reddit] Search failed "${query}":`, error.message);
    }
  }
  
  console.log(`[Reddit] Scrape complete: ${totalSaved} saved, ${totalSkipped} skipped, ${totalFiltered} filtered, ${totalErrors} errors`);
  
  return { saved: totalSaved, skipped: totalSkipped, filtered: totalFiltered, errors: totalErrors };
}

/**
 * Quick scrape — tier 1 only, for testing
 */
async function scrapeRedditQuick() {
  return scrapeReddit({
    subreddits: SUBREDDITS.tier1,
    sorts: ['hot'],
    scrapeComments: false,
    maxPostsPerSub: 50,
  });
}

module.exports = {
  scrapeReddit,
  scrapeRedditQuick,
  searchReddit,
  getAccessToken,
  ALL_SUBREDDITS,
  SUBREDDITS,
};
