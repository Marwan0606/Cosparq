#!/usr/bin/env node
/**
 * Run AI analysis on all unprocessed posts in the database.
 * Does NOT re-scrape — just analyzes what's already there.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../db/connect');
const TrendPost = require('../models/TrendPost');
const TrendScore = require('../models/TrendScore');
const { runFullAnalysis } = require('../services/trendAnalyzer');

async function main() {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const total = await TrendPost.countDocuments();
    const unprocessed = await TrendPost.countDocuments({ processed: { $ne: true } });
    const scores = await TrendScore.countDocuments();

    console.log(`📊 Posts: ${total} total, ${unprocessed} unprocessed`);
    console.log(`📊 TrendScores: ${scores}\n`);

    if (unprocessed === 0) {
      console.log('ℹ️  No unprocessed posts. Nothing to do.');
    } else {
      console.log(`🤖 Running AI analysis on ${unprocessed} posts...\n`);
      await runFullAnalysis();
      
      const finalScores = await TrendScore.countDocuments();
      const remaining = await TrendPost.countDocuments({ processed: { $ne: true } });
      console.log(`\n✅ Done! TrendScores: ${finalScores}, remaining unprocessed: ${remaining}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected');
  }
}

main();
