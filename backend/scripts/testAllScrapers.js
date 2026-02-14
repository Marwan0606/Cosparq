/**
 * Test script for all trend scrapers
 * Run: node scripts/testAllScrapers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function testScrapers() {
  console.log('='.repeat(60));
  console.log('TREND SCRAPER TEST');
  console.log('='.repeat(60));
  
  // Connect to MongoDB
  console.log('\n📦 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');
  
  // Check available API credentials
  console.log('\n🔑 API Credentials Status:');
  console.log('─'.repeat(40));
  
  const hasRedditOAuth = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  const hasTwitterOfficial = !!process.env.TWITTER_BEARER_TOKEN;
  const hasRapidApi = !!process.env.RAPIDAPI_KEY;
  
  console.log(`Reddit OAuth:      ${hasRedditOAuth ? '✅ Configured' : '❌ Missing REDDIT_CLIENT_ID/SECRET'}`);
  console.log(`Twitter Official:  ${hasTwitterOfficial ? '✅ Configured' : '❌ Missing TWITTER_BEARER_TOKEN'}`);
  console.log(`RapidAPI:          ${hasRapidApi ? '✅ Configured' : '❌ Missing RAPIDAPI_KEY'}`);
  console.log(`Hacker News:       ✅ No credentials needed (free API)`);
  
  // Import scrapers
  const { scrapeRedditQuick, getAccessToken } = require('../services/scrapers/redditScraper');
  const { scrapeHackerNewsQuick } = require('../services/scrapers/hnScraper');
  const { scrapeTwitterQuick, checkAvailableMethods } = require('../services/scrapers/twitterScraper');
  
  const results = {
    reddit: null,
    hackerNews: null,
    twitter: null
  };
  
  // Test Reddit
  console.log('\n🔴 Testing Reddit...');
  console.log('─'.repeat(40));
  try {
    if (hasRedditOAuth) {
      console.log('Attempting OAuth authentication...');
      const token = await getAccessToken();
      if (token) {
        console.log('✅ OAuth token obtained!');
      } else {
        console.log('⚠️  OAuth failed, will try unauthenticated...');
      }
    }
    
    results.reddit = await scrapeRedditQuick();
    console.log(`✅ Reddit: ${results.reddit.saved} new posts, ${results.reddit.skipped} existing`);
  } catch (error) {
    console.log(`❌ Reddit failed: ${error.message}`);
    results.reddit = { error: error.message };
  }
  
  // Test Hacker News
  console.log('\n🟠 Testing Hacker News...');
  console.log('─'.repeat(40));
  try {
    results.hackerNews = await scrapeHackerNewsQuick();
    console.log(`✅ HN: ${results.hackerNews.saved} new posts, ${results.hackerNews.skipped} existing`);
  } catch (error) {
    console.log(`❌ HN failed: ${error.message}`);
    results.hackerNews = { error: error.message };
  }
  
  // Test Twitter
  console.log('\n🐦 Testing Twitter...');
  console.log('─'.repeat(40));
  try {
    const methods = checkAvailableMethods();
    console.log(`Available methods: Official=${methods.official}, RapidAPI=${methods.rapidapi}, Nitter=${methods.nitter}`);
    
    if (methods.official || methods.rapidapi) {
      results.twitter = await scrapeTwitterQuick();
      console.log(`✅ Twitter (${results.twitter.method}): ${results.twitter.saved} new posts, ${results.twitter.skipped} existing`);
    } else {
      console.log('⚠️  Skipping Twitter - no API keys configured');
      console.log('   Add TWITTER_BEARER_TOKEN or RAPIDAPI_KEY to .env');
      results.twitter = { skipped: true, reason: 'no API keys' };
    }
  } catch (error) {
    console.log(`❌ Twitter failed: ${error.message}`);
    results.twitter = { error: error.message };
  }
  
  // Get database stats
  console.log('\n📊 Database Stats:');
  console.log('─'.repeat(40));
  
  const TrendPost = require('../models/TrendPost');
  const totalPosts = await TrendPost.countDocuments();
  const redditPosts = await TrendPost.countDocuments({ source: 'reddit' });
  const hnPosts = await TrendPost.countDocuments({ source: 'hackernews' });
  const twitterPosts = await TrendPost.countDocuments({ source: 'twitter' });
  const processedPosts = await TrendPost.countDocuments({ processed: true });
  
  console.log(`Total posts:     ${totalPosts}`);
  console.log(`├─ Reddit:       ${redditPosts}`);
  console.log(`├─ Hacker News:  ${hnPosts}`);
  console.log(`├─ Twitter:      ${twitterPosts}`);
  console.log(`└─ Processed:    ${processedPosts}`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const totalNew = (results.reddit?.saved || 0) + 
                   (results.hackerNews?.saved || 0) + 
                   (results.twitter?.saved || 0);
  
  console.log(`New posts collected: ${totalNew}`);
  console.log(`Total in database:   ${totalPosts}`);
  
  if (!hasRedditOAuth) {
    console.log('\n⚠️  To enable Reddit (best data source):');
    console.log('   1. Go to https://www.reddit.com/prefs/apps');
    console.log('   2. Create a "script" type app');
    console.log('   3. Add credentials to .env:');
    console.log('      REDDIT_CLIENT_ID=your_client_id');
    console.log('      REDDIT_CLIENT_SECRET=your_secret');
    console.log('      REDDIT_USERNAME=your_username');
    console.log('      REDDIT_PASSWORD=your_password');
  }
  
  if (!hasTwitterOfficial && !hasRapidApi) {
    console.log('\n⚠️  To enable Twitter:');
    console.log('   Option 1 - Official API ($100/mo):');
    console.log('      Get TWITTER_BEARER_TOKEN from developer.twitter.com');
    console.log('   Option 2 - RapidAPI (~$10-50/mo):');
    console.log('      Subscribe to Twitter API on rapidapi.com');
    console.log('      Add RAPIDAPI_KEY to .env');
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Test complete!');
}

testScrapers().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
