#!/usr/bin/env node
/**
 * Run the full new-sources pipeline:
 * 1. Connect to DB
 * 2. Optionally clean old Reddit/Twitter data
 * 3. Scrape all new sources (TAAFT, BetaList, GitHub, HN, ProductHunt)
 * 4. Run AI analysis on new posts
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../db/connect');
const TrendPost = require('../models/TrendPost');
const TrendScore = require('../models/TrendScore');

// Scrapers
const { scrapeTAAFT } = require('../services/scrapers/taaftScraper');
const { scrapeBetaList } = require('../services/scrapers/betaListScraper');
const { scrapeGitHubTrending } = require('../services/scrapers/githubTrendingScraper');
const { scrapeHackerNews, scrapeShowHN } = require('../services/scrapers/hnScraper');

// Analyzer
const { runFullAnalysis } = require('../services/trendAnalyzer');

const CLEAN_OLD = process.argv.includes('--clean');

async function main() {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Show current state
    const totalPosts = await TrendPost.countDocuments();
    const bySource = await TrendPost.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const trendScores = await TrendScore.countDocuments();

    console.log('📊 Current state:');
    console.log(`   Total posts: ${totalPosts}`);
    bySource.forEach(s => console.log(`   - ${s._id}: ${s.count}`));
    console.log(`   TrendScores: ${trendScores}\n`);

    // --- Step 1: Clean old data (if --clean flag) ---
    if (CLEAN_OLD) {
      console.log('🧹 Cleaning old Reddit/Twitter data...');
      const delReddit = await TrendPost.deleteMany({ source: 'reddit' });
      const delTwitter = await TrendPost.deleteMany({ source: 'twitter' });
      const delOther = await TrendPost.deleteMany({ source: 'other' });
      console.log(`   Deleted: ${delReddit.deletedCount} reddit, ${delTwitter.deletedCount} twitter, ${delOther.deletedCount} other`);

      // Drop stale trend scores
      await TrendScore.deleteMany({});
      console.log('   Dropped all TrendScores\n');

      // Reset processed flags on remaining posts
      const resetResult = await TrendPost.updateMany({}, { $set: { processed: false } });
      console.log(`   Reset ${resetResult.modifiedCount} posts to unprocessed\n`);
    }

    // --- Step 2: Scrape new sources ---
    console.log('🔍 Scraping new sources...\n');

    console.log('--- TAAFT (theresanaiforthat.com) ---');
    const taaftResult = await scrapeTAAFT();
    console.log(`   Result: ${JSON.stringify(taaftResult)}\n`);

    console.log('--- BetaList ---');
    const betaResult = await scrapeBetaList();
    console.log(`   Result: ${JSON.stringify(betaResult)}\n`);

    console.log('--- GitHub Trending ---');
    const ghResult = await scrapeGitHubTrending();
    console.log(`   Result: ${JSON.stringify(ghResult)}\n`);

    console.log('--- Hacker News ---');
    const hnResult = await scrapeHackerNews();
    console.log(`   Result: ${JSON.stringify(hnResult)}\n`);

    console.log('--- Show HN ---');
    const showHnResult = await scrapeShowHN();
    console.log(`   Result: ${JSON.stringify(showHnResult)}\n`);

    // ProductHunt requires API token
    if (process.env.PH_API_TOKEN) {
      const { scrapeProductHunt } = require('../services/scrapers/productHuntScraper');
      console.log('--- Product Hunt (API) ---');
      const phResult = await scrapeProductHunt(7);
      console.log(`   Result: ${JSON.stringify(phResult)}\n`);
    } else {
      console.log('--- Product Hunt: SKIPPED (set PH_API_TOKEN for access) ---\n');
    }

    // --- Step 3: Show new totals ---
    const newTotal = await TrendPost.countDocuments();
    const newBySource = await TrendPost.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const unprocessed = await TrendPost.countDocuments({ processed: { $ne: true } });

    console.log('\n📊 After scraping:');
    console.log(`   Total posts: ${newTotal}`);
    newBySource.forEach(s => console.log(`   - ${s._id}: ${s.count}`));
    console.log(`   Unprocessed: ${unprocessed}\n`);

    // --- Step 4: Run AI analysis ---
    if (unprocessed > 0) {
      console.log('🤖 Running AI analysis on unprocessed posts...\n');
      await runFullAnalysis();
      console.log('\n✅ Analysis complete!');
    } else {
      console.log('ℹ️  No unprocessed posts to analyze.');
    }

    // Final state
    const finalScores = await TrendScore.countDocuments();
    console.log(`\n📊 Final state: ${finalScores} TrendScores`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

main();
