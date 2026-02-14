/**
 * Trend Cron Service
 * Orchestrates daily scraping and analysis jobs
 * Runs at 3 AM daily to collect and process trend data
 * 
 * Sources:
 * - Reddit (OAuth required for full access)
 * - Hacker News (free, unlimited)
 * - Twitter/X (API key or RapidAPI required)
 */

const cron = require('node-cron');
const { scrapeHackerNews, scrapeShowHN } = require('./scrapers/hnScraper');
const { scrapeProductHunt } = require('./scrapers/productHuntScraper');
const { scrapeTAAFT } = require('./scrapers/taaftScraper');
const { scrapeBetaList } = require('./scrapers/betaListScraper');
const { scrapeGitHubTrending } = require('./scrapers/githubTrendingScraper');
const { runFullAnalysis } = require('./trendAnalyzer');
const TrendPost = require('../models/TrendPost');
const TrendScore = require('../models/TrendScore');

// Track job status
let isRunning = false;
let lastRunAt = null;
let lastRunResult = null;

/**
 * Run the complete scraping and analysis pipeline
 */
async function runTrendPipeline() {
  if (isRunning) {
    console.log('[TrendCron] Pipeline already running, skipping...');
    return { skipped: true, reason: 'already running' };
  }
  
  isRunning = true;
  const startTime = Date.now();
  console.log('[TrendCron] Starting trend pipeline...');
  
  const results = {
    startedAt: new Date(),
    scraping: { reddit: null, hackerNews: null, showHN: null },
    analysis: null,
    cleanup: null,
    duration: null,
    errors: []
  };
  
  try {
    // Step 1: Product Hunt (highest quality — real product launches)
    console.log('[TrendCron] Step 1/7: Scraping Product Hunt...');
    try {
      results.scraping.productHunt = await scrapeProductHunt();
    } catch (error) {
      console.error('[TrendCron] Product Hunt scraping failed:', error.message);
      results.errors.push({ step: 'producthunt', error: error.message });
    }
    
    // Step 2: TAAFT — AI tool launches
    console.log('[TrendCron] Step 2/7: Scraping TAAFT...');
    try {
      results.scraping.taaft = await scrapeTAAFT();
    } catch (error) {
      console.error('[TrendCron] TAAFT scraping failed:', error.message);
      results.errors.push({ step: 'taaft', error: error.message });
    }
    
    // Step 3: BetaList — early-stage startups
    console.log('[TrendCron] Step 3/7: Scraping BetaList...');
    try {
      results.scraping.betaList = await scrapeBetaList();
    } catch (error) {
      console.error('[TrendCron] BetaList scraping failed:', error.message);
      results.errors.push({ step: 'betalist', error: error.message });
    }
    
    // Step 4: GitHub Trending — open source & dev tools
    console.log('[TrendCron] Step 4/7: Scraping GitHub Trending...');
    try {
      results.scraping.github = await scrapeGitHubTrending();
    } catch (error) {
      console.error('[TrendCron] GitHub scraping failed:', error.message);
      results.errors.push({ step: 'github', error: error.message });
    }
    
    // Step 5: Hacker News — tech community signal
    console.log('[TrendCron] Step 5/7: Scraping Hacker News...');
    try {
      results.scraping.hackerNews = await scrapeHackerNews();
      results.scraping.showHN = await scrapeShowHN();
    } catch (error) {
      console.error('[TrendCron] HN scraping failed:', error.message);
      results.errors.push({ step: 'hackernews', error: error.message });
    }
    
    // Step 6: AI Analysis
    console.log('[TrendCron] Step 6/7: Running AI analysis...');
    try {
      results.analysis = await runFullAnalysis();
    } catch (error) {
      console.error('[TrendCron] AI analysis failed:', error.message);
      results.errors.push({ step: 'analysis', error: error.message });
    }
    
    // Step 7: Cleanup old data
    console.log('[TrendCron] Step 7/7: Cleaning up old data...');
    try {
      results.cleanup = await cleanupOldData();
    } catch (error) {
      console.error('[TrendCron] Cleanup failed:', error.message);
      results.errors.push({ step: 'cleanup', error: error.message });
    }
    
  } catch (error) {
    console.error('[TrendCron] Pipeline failed:', error.message);
    results.errors.push({ step: 'pipeline', error: error.message });
  } finally {
    isRunning = false;
    results.duration = Date.now() - startTime;
    results.completedAt = new Date();
    lastRunAt = new Date();
    lastRunResult = results;
  }
  
  console.log(`[TrendCron] Pipeline complete in ${Math.round(results.duration / 1000)}s`);
  console.log(`[TrendCron] Errors: ${results.errors.length}`);
  
  return results;
}

/**
 * Clean up old posts (older than 30 days)
 */
async function cleanupOldData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const result = await TrendPost.deleteMany({
    sourceCreatedAt: { $lt: thirtyDaysAgo }
  });
  
  console.log(`[TrendCron] Deleted ${result.deletedCount} old posts`);
  
  return { deletedPosts: result.deletedCount };
}

/**
 * Quick scrape for testing (smaller dataset)
 */
async function runQuickPipeline() {
  if (isRunning) {
    return { skipped: true, reason: 'already running' };
  }
  
  isRunning = true;
  console.log('[TrendCron] Running quick pipeline...');
  
  const results = {
    scraping: {},
    analysis: null
  };
  
  try {
    // Quick scrapes from high-quality sources
    const { scrapeProductHuntQuick } = require('./scrapers/productHuntScraper');
    const { scrapeTAAFTQuick } = require('./scrapers/taaftScraper');
    const { scrapeBetaListQuick } = require('./scrapers/betaListScraper');
    const { scrapeGitHubTrendingQuick } = require('./scrapers/githubTrendingScraper');
    const { scrapeHackerNewsQuick } = require('./scrapers/hnScraper');
    
    results.scraping.productHunt = await scrapeProductHuntQuick();
    results.scraping.taaft = await scrapeTAAFTQuick();
    results.scraping.betaList = await scrapeBetaListQuick();
    results.scraping.github = await scrapeGitHubTrendingQuick();
    results.scraping.hackerNews = await scrapeHackerNewsQuick();
    
    results.analysis = await runFullAnalysis();
    
  } catch (error) {
    console.error('[TrendCron] Quick pipeline failed:', error.message);
  } finally {
    isRunning = false;
  }
  
  return results;
}

/**
 * Get pipeline status
 */
function getStatus() {
  return {
    isRunning,
    lastRunAt,
    lastRunResult
  };
}

/**
 * Get stats about collected data
 */
async function getStats() {
  const totalPosts = await TrendPost.countDocuments();
  const processedPosts = await TrendPost.countDocuments({ processed: true });
  const unprocessedPosts = await TrendPost.countDocuments({ processed: false });
  
  const sourceCounts = await TrendPost.aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } }
  ]);
  
  const categoryCounts = await TrendPost.aggregate([
    { $match: { processed: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  const trendScores = await TrendScore.find({})
    .sort({ weightedScore: -1 })
    .limit(10);
  
  return {
    posts: {
      total: totalPosts,
      processed: processedPosts,
      unprocessed: unprocessedPosts
    },
    sources: sourceCounts.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {}),
    categories: categoryCounts,
    topTrends: trendScores.map(t => ({
      category: t.category,
      score: t.weightedScore,
      mentions: t.mentionCount,
      velocity: t.velocity
    }))
  };
}

/**
 * Initialize cron jobs
 */
function initCronJobs() {
  // Main pipeline - runs daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[TrendCron] Starting scheduled daily pipeline...');
    await runTrendPipeline();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  // Secondary scrape - runs at 3 PM for afternoon updates
  cron.schedule('0 15 * * *', async () => {
    console.log('[TrendCron] Starting afternoon scrape...');
    try {
      await scrapeProductHunt(1);
      await scrapeHackerNews({ feeds: ['topstories'] });
      await scrapeGitHubTrending();
    } catch (error) {
      console.error('[TrendCron] Afternoon scrape failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('[TrendCron] Cron jobs initialized');
  console.log('[TrendCron] - Daily pipeline: 3:00 AM UTC');
  console.log('[TrendCron] - Afternoon scrape: 3:00 PM UTC');
}

module.exports = {
  initCronJobs,
  runTrendPipeline,
  runQuickPipeline,
  getStatus,
  getStats,
  cleanupOldData
};
