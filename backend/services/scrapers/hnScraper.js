/**
 * Hacker News Scraper Service
 * Fetches stories from Hacker News using their public Firebase API
 * 
 * HN API docs: https://github.com/HackerNews/API
 * No authentication required, very generous rate limits
 */

const TrendPost = require('../../models/TrendPost');

// API endpoints
const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

// Rate limiting (HN is generous but let's be respectful)
const DELAY_BETWEEN_REQUESTS = 100; // 100ms between item fetches
const MAX_STORIES_PER_FEED = 500; // Increased for more data

/**
 * Fetch story IDs from a feed
 */
async function fetchStoryIds(feed = 'topstories') {
  const url = `${HN_API_BASE}/${feed}.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[HN] Error fetching ${feed}:`, error.message);
    return [];
  }
}

/**
 * Fetch a single item (story or comment)
 */
async function fetchItem(id) {
  const url = `${HN_API_BASE}/item/${id}.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[HN] Error fetching item ${id}:`, error.message);
    return null;
  }
}

/**
 * Fetch multiple items in parallel with rate limiting
 */
async function fetchItems(ids, batchSize = 10) {
  const items = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchItem));
    items.push(...results.filter(Boolean));
    
    // Small delay between batches
    if (i + batchSize < ids.length) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  return items;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Filter for relevant startup/tech stories
 * HN has a lot of content, we want to focus on what matters for trends
 */
function isRelevantStory(story) {
  if (!story || story.deleted || story.dead) return false;
  if (story.type !== 'story') return false;
  
  const title = (story.title || '').toLowerCase();
  const url = (story.url || '').toLowerCase();
  
  // Keywords that indicate startup/tech relevance
  const relevantKeywords = [
    // Startup terms
    'startup', 'launch', 'founder', 'saas', 'b2b', 'b2c',
    'mvp', 'product', 'market', 'growth', 'revenue', 'funding',
    'vc', 'investor', 'seed', 'series a', 'bootstrap',
    
    // Tech terms
    'ai', 'ml', 'machine learning', 'gpt', 'llm', 'openai', 'anthropic',
    'api', 'sdk', 'framework', 'library', 'open source',
    'cloud', 'aws', 'azure', 'gcp', 'serverless',
    'react', 'vue', 'node', 'python', 'rust', 'go',
    
    // Business/Problem terms
    'problem', 'solution', 'customer', 'user', 'feedback',
    'pricing', 'monetization', 'subscription', 'freemium',
    'automation', 'workflow', 'productivity', 'tool',
    
    // Show HN / Ask HN (high signal)
    'show hn', 'ask hn', 'launch hn'
  ];
  
  // Check if any keyword matches
  const hasRelevantKeyword = relevantKeywords.some(kw => 
    title.includes(kw) || url.includes(kw)
  );
  
  // Also consider high-engagement posts even without keywords
  const hasHighEngagement = (story.score || 0) > 50 || (story.descendants || 0) > 20;
  
  return hasRelevantKeyword || hasHighEngagement;
}

/**
 * Transform HN story to our schema
 */
function transformStory(story) {
  return {
    source: 'hackernews',
    sourceId: String(story.id),
    title: story.title || '',
    content: story.text || '', // Self-posts have text
    url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
    author: story.by || 'unknown',
    upvotes: story.score || 0,
    comments: story.descendants || 0,
    sourceCreatedAt: new Date(story.time * 1000),
    fetchedAt: new Date(),
    metadata: {
      type: story.type,
      isShowHN: (story.title || '').toLowerCase().includes('show hn'),
      isAskHN: (story.title || '').toLowerCase().includes('ask hn')
    }
  };
}

/**
 * Save posts to database
 */
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
      if (error.code !== 11000) {
        console.error('[HN] Error saving post:', error.message);
      }
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scraping function
 * Fetches stories from multiple HN feeds
 */
async function scrapeHackerNews(options = {}) {
  const {
    feeds = ['topstories', 'newstories', 'beststories'],
    maxPerFeed = MAX_STORIES_PER_FEED,
    filterRelevant = true
  } = options;
  
  console.log(`[HN] Starting scrape of ${feeds.length} feeds...`);
  
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;
  
  for (const feed of feeds) {
    console.log(`[HN] Fetching ${feed}...`);
    
    try {
      // Get story IDs
      const storyIds = await fetchStoryIds(feed);
      const idsToFetch = storyIds.slice(0, maxPerFeed);
      
      console.log(`[HN] Found ${storyIds.length} stories, fetching ${idsToFetch.length}...`);
      
      // Fetch full story data
      const stories = await fetchItems(idsToFetch);
      
      // Filter for relevance
      let relevantStories = stories;
      if (filterRelevant) {
        relevantStories = stories.filter(isRelevantStory);
        totalFiltered += stories.length - relevantStories.length;
      }
      
      // Filter out old posts (> 7 days)
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentStories = relevantStories.filter(s => {
        const createdAt = s.time * 1000;
        return createdAt > oneWeekAgo;
      });
      
      // Transform and save
      const transformedPosts = recentStories.map(transformStory);
      const { saved, skipped } = await savePosts(transformedPosts);
      
      totalSaved += saved;
      totalSkipped += skipped;
      
      console.log(`[HN] ${feed}: ${saved} new, ${skipped} existing, ${totalFiltered} filtered`);
      
    } catch (error) {
      console.error(`[HN] Failed to scrape ${feed}:`, error.message);
    }
    
    // Delay between feeds
    await sleep(1000);
  }
  
  console.log(`[HN] Scrape complete: ${totalSaved} saved, ${totalSkipped} skipped, ${totalFiltered} filtered`);
  
  return {
    saved: totalSaved,
    skipped: totalSkipped,
    filtered: totalFiltered
  };
}

/**
 * Quick scrape for testing
 */
async function scrapeHackerNewsQuick() {
  return scrapeHackerNews({
    feeds: ['topstories'],
    maxPerFeed: 50,
    filterRelevant: true
  });
}

/**
 * Scrape Show HN specifically (high-signal for startup ideas)
 */
async function scrapeShowHN() {
  console.log('[HN] Fetching Show HN stories...');
  
  const storyIds = await fetchStoryIds('showstories');
  const stories = await fetchItems(storyIds.slice(0, 100));
  
  // Filter for recent
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentStories = stories.filter(s => s && s.time * 1000 > oneWeekAgo);
  
  const transformedPosts = recentStories.map(transformStory);
  const { saved, skipped } = await savePosts(transformedPosts);
  
  console.log(`[HN] Show HN: ${saved} new, ${skipped} existing`);
  
  return { saved, skipped };
}

module.exports = {
  scrapeHackerNews,
  scrapeHackerNewsQuick,
  scrapeShowHN
};
