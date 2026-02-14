/**
 * Test script for Trend Map feature
 * Run with: node scripts/testTrends.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected!\n');

  // Import after DB connection
  const { scrapeRedditQuick } = require('../services/scrapers/redditScraper');
  const { scrapeHackerNewsQuick } = require('../services/scrapers/hnScraper');
  const { processUnprocessedPosts, aggregateTrends } = require('../services/trendAnalyzer');
  const TrendPost = require('../models/TrendPost');
  const TrendScore = require('../models/TrendScore');

  // Step 1: Scrape Reddit (quick mode - 4 subreddits)
  console.log('📡 STEP 1: Scraping Reddit (quick mode)...');
  console.log('─'.repeat(50));
  const redditResult = await scrapeRedditQuick();
  console.log(`   Saved: ${redditResult.saved}, Skipped: ${redditResult.skipped}\n`);

  // Step 2: Scrape Hacker News (quick mode)
  console.log('📡 STEP 2: Scraping Hacker News (quick mode)...');
  console.log('─'.repeat(50));
  const hnResult = await scrapeHackerNewsQuick();
  console.log(`   Saved: ${hnResult.saved}, Skipped: ${hnResult.skipped}\n`);

  // Check what we have
  const totalPosts = await TrendPost.countDocuments();
  const unprocessed = await TrendPost.countDocuments({ processed: false });
  console.log(`📊 Total posts in DB: ${totalPosts}`);
  console.log(`   Unprocessed: ${unprocessed}\n`);

  // Step 3: AI Analysis (only if we have unprocessed posts)
  if (unprocessed > 0) {
    console.log('🤖 STEP 3: Running AI analysis on posts...');
    console.log('─'.repeat(50));
    console.log('   (This may take a minute - analyzing with GPT-4o-mini)\n');
    
    const analysisResult = await processUnprocessedPosts({ limit: 50 });
    console.log(`   Processed: ${analysisResult.processed} posts in ${analysisResult.batches} batches\n`);

    // Step 4: Aggregate into trends
    console.log('📈 STEP 4: Aggregating trends...');
    console.log('─'.repeat(50));
    await aggregateTrends();
  } else {
    console.log('⏭️  Skipping AI analysis (no new posts)\n');
  }

  // Show results
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESULTS');
  console.log('═'.repeat(50));

  const trends = await TrendScore.find({}).sort({ weightedScore: -1 }).limit(10);
  
  if (trends.length === 0) {
    console.log('No trends yet. Run again after collecting more data.');
  } else {
    console.log('\nTop Categories by Score:');
    trends.forEach((t, i) => {
      const arrow = t.velocity > 0 ? '↑' : t.velocity < 0 ? '↓' : '→';
      console.log(`  ${i + 1}. ${t.category.padEnd(15)} Score: ${t.weightedScore.toString().padStart(5)} | Mentions: ${t.mentionCount} ${arrow}`);
    });

    // Show top pain points
    const topTrend = trends[0];
    if (topTrend?.topPainPoints?.length > 0) {
      console.log(`\nTop Pain Points in "${topTrend.category}":`);
      topTrend.topPainPoints.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.painPoint} (${p.mentions} mentions)`);
      });
    }
  }

  // Sample posts
  console.log('\n📝 Sample Analyzed Posts:');
  const samplePosts = await TrendPost.find({ processed: true })
    .sort({ demandSignal: -1 })
    .limit(3);
  
  samplePosts.forEach((p, i) => {
    console.log(`\n  ${i + 1}. "${p.title.slice(0, 60)}..."`);
    console.log(`     Category: ${p.category} | Demand: ${p.demandSignal}/100`);
    console.log(`     Topics: ${p.topics?.slice(0, 3).join(', ') || 'none'}`);
    console.log(`     Pain Points: ${p.painPoints?.slice(0, 2).join(', ') || 'none'}`);
  });

  console.log('\n✅ Test complete!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
