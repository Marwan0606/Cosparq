/**
 * Twitter/X Scraper Service
 * Fetches tweets from tech-related accounts and searches
 * 
 * Uses multiple approaches:
 * 1. Official API (if you have API keys - expensive but reliable)
 * 2. RapidAPI Twitter endpoints (cheaper alternative)
 * 3. Nitter scraping (free but can break)
 * 
 * Setup for Official API:
 * 1. Go to https://developer.twitter.com/
 * 2. Create a project and app
 * 3. Get Bearer Token
 * 4. Add to .env: TWITTER_BEARER_TOKEN
 * 
 * Setup for RapidAPI (recommended - cheaper):
 * 1. Go to https://rapidapi.com/
 * 2. Subscribe to "Twitter API v2" or similar
 * 3. Get API key
 * 4. Add to .env: RAPIDAPI_KEY
 */

const TrendPost = require('../../models/TrendPost');

// Tech-related Twitter accounts to follow
const TECH_ACCOUNTS = [
  // Tech News
  'TechCrunch',
  'TheVerge',
  'WIRED',
  'engadget',
  'mashable',
  'aaborgar',
  'caborgar',
  'VentureBeat',
  'TNW',
  
  // Startup/VC
  'ycombinator',
  'ProductHunt',
  'IndieHackers',
  'a16z',
  'sequoia',
  'naval',
  'paulg',
  'sama',
  'elikiw',
  
  // AI/ML
  'OpenAI',
  'AnthropicAI',
  'GoogleAI',
  'DeepMind',
  'huggingface',
  'LangChainAI',
  'llaboratorai',
  
  // Dev Community
  'github',
  'vercel',
  'supabase',
  'stripe',
  'twaborilio',
  'awscloud',
  
  // Influential Founders
  'levelsio',
  'marckohlbrugge',
  'tdinh_me',
  'araborvidsson',
  'dannypostmaa',
  'yaborngboy1',
  
  // Tech Journalists/Influencers
  'benedictevans',
  'saborhl',
  'andrewchen',
  'lennysan',
  'pacaborkyp'
];

// Search terms for finding relevant discussions
const SEARCH_TERMS = [
  // Pain points
  '"need a tool"',
  '"wish there was"',
  '"frustrated with"',
  '"hate how"',
  '"why is it so hard"',
  '"looking for a solution"',
  
  // Startup launches
  '"just launched"',
  '"shipped my"',
  '"built this"',
  '"side project"',
  '#buildinpublic',
  '#indiehackers',
  
  // AI/Tech trends
  'AI startup',
  'SaaS launch',
  'no-code tool',
  'LLM application',
  'GPT wrapper',
  
  // Problem discussions
  '"the biggest problem"',
  '"main challenge"',
  '"pain point"',
  'underserved market'
];

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds
const MAX_TWEETS_PER_SEARCH = 100;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Official Twitter API v2 request
 */
async function twitterApiRequest(endpoint, params = {}) {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  
  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN not set');
  }
  
  const queryString = new URLSearchParams(params).toString();
  const url = `https://api.twitter.com/2${endpoint}${queryString ? '?' + queryString : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * RapidAPI Twitter request (cheaper alternative)
 */
async function rapidApiRequest(endpoint, params = {}) {
  const apiKey = process.env.RAPIDAPI_KEY;
  
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not set');
  }
  
  const queryString = new URLSearchParams(params).toString();
  // Using Twitter135 API on RapidAPI (one of the cheapest)
  const url = `https://twitter135.p.rapidapi.com${endpoint}${queryString ? '?' + queryString : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'twitter135.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RapidAPI error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Nitter scraping (free alternative - uses public Nitter instances)
 * Note: This can be unreliable as instances go up and down
 */
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.woodland.cafe',
  'https://nitter.1d4.us'
];

let currentNitterInstance = 0;

async function nitterRequest(path) {
  const maxRetries = NITTER_INSTANCES.length;
  
  for (let i = 0; i < maxRetries; i++) {
    const instance = NITTER_INSTANCES[(currentNitterInstance + i) % NITTER_INSTANCES.length];
    const url = `${instance}${path}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        currentNitterInstance = (currentNitterInstance + i) % NITTER_INSTANCES.length;
        return response.text();
      }
    } catch (error) {
      console.log(`[Twitter] Nitter instance ${instance} failed, trying next...`);
    }
  }
  
  throw new Error('All Nitter instances failed');
}

/**
 * Parse tweets from Nitter HTML
 */
function parseNitterTweets(html, source = 'unknown') {
  const tweets = [];
  
  // Simple regex parsing (not perfect but works for basic extraction)
  const tweetPattern = /<div class="tweet-content[^"]*"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/div>/gi;
  const linkPattern = /<a[^>]*href="\/([^/]+)\/status\/(\d+)"[^>]*>/gi;
  const textPattern = /<div class="tweet-content[^"]*">([^<]+)/gi;
  
  let match;
  const seenIds = new Set();
  
  // Extract tweet links and IDs
  while ((match = linkPattern.exec(html)) !== null) {
    const [_, username, tweetId] = match;
    if (!seenIds.has(tweetId)) {
      seenIds.add(tweetId);
      tweets.push({
        id: tweetId,
        username: username,
        source: source
      });
    }
  }
  
  return tweets;
}

/**
 * Search tweets using official API
 */
async function searchTweetsOfficial(query, maxResults = 100) {
  try {
    const params = {
      query: `${query} -is:retweet lang:en`,
      max_results: Math.min(maxResults, 100),
      'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
      'user.fields': 'username,name,verified',
      expansions: 'author_id'
    };
    
    const data = await twitterApiRequest('/tweets/search/recent', params);
    return data;
  } catch (error) {
    console.error(`[Twitter] Official API search failed: ${error.message}`);
    return null;
  }
}

/**
 * Search tweets using RapidAPI
 */
async function searchTweetsRapidApi(query, count = 100) {
  try {
    const data = await rapidApiRequest('/Search/', {
      q: query,
      count: count,
      type: 'Latest'
    });
    return data;
  } catch (error) {
    console.error(`[Twitter] RapidAPI search failed: ${error.message}`);
    return null;
  }
}

/**
 * Get user tweets using Nitter
 */
async function getUserTweetsNitter(username) {
  try {
    const html = await nitterRequest(`/${username}`);
    return parseNitterTweets(html, username);
  } catch (error) {
    console.error(`[Twitter] Nitter scrape failed for @${username}: ${error.message}`);
    return [];
  }
}

/**
 * Transform tweet to our schema
 */
function transformTweet(tweet, source = 'twitter') {
  // Handle different API response formats
  if (tweet.data) {
    // Official API format
    return {
      source: 'twitter',
      sourceId: tweet.data.id,
      title: '', // Twitter doesn't have titles
      content: tweet.data.text || '',
      url: `https://twitter.com/i/status/${tweet.data.id}`,
      author: tweet.includes?.users?.[0]?.username || 'unknown',
      upvotes: tweet.data.public_metrics?.like_count || 0,
      comments: tweet.data.public_metrics?.reply_count || 0,
      retweets: tweet.data.public_metrics?.retweet_count || 0,
      sourceCreatedAt: new Date(tweet.data.created_at),
      fetchedAt: new Date()
    };
  } else if (tweet.text) {
    // RapidAPI or simplified format
    return {
      source: 'twitter',
      sourceId: tweet.id || tweet.id_str || `tw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      content: tweet.text || tweet.full_text || '',
      url: tweet.url || `https://twitter.com/i/status/${tweet.id}`,
      author: tweet.user?.screen_name || tweet.username || 'unknown',
      upvotes: tweet.favorite_count || tweet.likes || 0,
      comments: tweet.reply_count || 0,
      retweets: tweet.retweet_count || 0,
      sourceCreatedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      fetchedAt: new Date()
    };
  } else {
    // Nitter format (minimal)
    return {
      source: 'twitter',
      sourceId: tweet.id || `tw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      content: tweet.content || '',
      url: `https://twitter.com/${tweet.username}/status/${tweet.id}`,
      author: tweet.username || 'unknown',
      upvotes: 0,
      comments: 0,
      retweets: 0,
      sourceCreatedAt: new Date(),
      fetchedAt: new Date()
    };
  }
}

/**
 * Save tweets to database
 */
async function saveTweets(tweets) {
  let saved = 0;
  let skipped = 0;
  
  for (const tweet of tweets) {
    try {
      const result = await TrendPost.findOneAndUpdate(
        { source: tweet.source, sourceId: tweet.sourceId },
        { $setOnInsert: tweet },
        { upsert: true, new: true, rawResult: true }
      );
      
      if (result.lastErrorObject?.updatedExisting === false) {
        saved++;
      } else {
        skipped++;
      }
    } catch (error) {
      if (error.code !== 11000) {
        console.error('[Twitter] Error saving tweet:', error.message);
      }
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scraping function
 * Tries multiple methods in order of preference
 */
async function scrapeTwitter(options = {}) {
  const {
    accounts = TECH_ACCOUNTS,
    searchTerms = SEARCH_TERMS,
    maxTweetsPerSearch = MAX_TWEETS_PER_SEARCH,
    method = 'auto' // 'official', 'rapidapi', 'nitter', 'auto'
  } = options;
  
  console.log(`[Twitter] Starting scrape (method: ${method})...`);
  
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let usedMethod = method;
  
  // Determine which method to use
  const hasOfficialApi = !!process.env.TWITTER_BEARER_TOKEN;
  const hasRapidApi = !!process.env.RAPIDAPI_KEY;
  
  if (method === 'auto') {
    if (hasOfficialApi) {
      usedMethod = 'official';
    } else if (hasRapidApi) {
      usedMethod = 'rapidapi';
    } else {
      usedMethod = 'nitter';
    }
  }
  
  console.log(`[Twitter] Using method: ${usedMethod}`);
  
  // Search for trending topics and pain points
  console.log(`[Twitter] Searching ${searchTerms.length} terms...`);
  
  for (const term of searchTerms) {
    try {
      console.log(`[Twitter] Searching: ${term}`);
      
      let results = null;
      
      if (usedMethod === 'official') {
        results = await searchTweetsOfficial(term, maxTweetsPerSearch);
        if (results?.data) {
          const transformed = results.data.map(t => transformTweet({ data: t, includes: results.includes }));
          const { saved, skipped } = await saveTweets(transformed);
          totalSaved += saved;
          totalSkipped += skipped;
          console.log(`[Twitter] "${term}": ${saved} new, ${skipped} existing`);
        }
      } else if (usedMethod === 'rapidapi') {
        results = await searchTweetsRapidApi(term, maxTweetsPerSearch);
        if (results?.statuses || results?.tweets) {
          const tweets = results.statuses || results.tweets || [];
          const transformed = tweets.map(t => transformTweet(t));
          const { saved, skipped } = await saveTweets(transformed);
          totalSaved += saved;
          totalSkipped += skipped;
          console.log(`[Twitter] "${term}": ${saved} new, ${skipped} existing`);
        }
      }
      
      await sleep(DELAY_BETWEEN_REQUESTS);
      
    } catch (error) {
      console.error(`[Twitter] Search failed for "${term}": ${error.message}`);
      totalErrors++;
    }
  }
  
  // Fetch from specific accounts (Nitter fallback)
  if (usedMethod === 'nitter') {
    console.log(`[Twitter] Fetching from ${accounts.length} accounts via Nitter...`);
    
    for (const account of accounts.slice(0, 20)) { // Limit to avoid rate limiting
      try {
        console.log(`[Twitter] Fetching @${account}...`);
        const tweets = await getUserTweetsNitter(account);
        
        if (tweets.length > 0) {
          const transformed = tweets.map(t => transformTweet(t));
          const { saved, skipped } = await saveTweets(transformed);
          totalSaved += saved;
          totalSkipped += skipped;
          console.log(`[Twitter] @${account}: ${saved} new, ${skipped} existing`);
        }
        
        await sleep(DELAY_BETWEEN_REQUESTS);
        
      } catch (error) {
        console.error(`[Twitter] Failed to fetch @${account}: ${error.message}`);
        totalErrors++;
      }
    }
  }
  
  console.log(`[Twitter] Scrape complete: ${totalSaved} saved, ${totalSkipped} skipped, ${totalErrors} errors`);
  
  return {
    saved: totalSaved,
    skipped: totalSkipped,
    errors: totalErrors,
    method: usedMethod
  };
}

/**
 * Quick scrape - just search terms
 */
async function scrapeTwitterQuick() {
  return scrapeTwitter({
    searchTerms: [
      '#buildinpublic',
      '#indiehackers',
      'AI startup launch',
      '"just shipped"',
      'SaaS idea'
    ],
    maxTweetsPerSearch: 50
  });
}

/**
 * Check which Twitter API methods are available
 */
function checkAvailableMethods() {
  return {
    official: !!process.env.TWITTER_BEARER_TOKEN,
    rapidapi: !!process.env.RAPIDAPI_KEY,
    nitter: true // Always available but unreliable
  };
}

module.exports = {
  scrapeTwitter,
  scrapeTwitterQuick,
  searchTweetsOfficial,
  searchTweetsRapidApi,
  checkAvailableMethods,
  TECH_ACCOUNTS,
  SEARCH_TERMS
};
