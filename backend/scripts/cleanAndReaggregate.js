#!/usr/bin/env node
/**
 * Clean old junk data and re-aggregate trends
 * 
 * Steps:
 * 1. Drop all TrendScore documents (stale aggregations)
 * 2. Reset all TrendPost `processed` flags so the new two-pass analyzer can re-evaluate them
 * 3. Run the full analysis pipeline (pre-filter → AI relevance gate → deep analysis → aggregate)
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

    // --- Step 1: Show current state ---
    const totalPosts = await TrendPost.countDocuments();
    const processedPosts = await TrendPost.countDocuments({ processed: true });
    const otherPosts = await TrendPost.countDocuments({ category: 'other' });
    const trendScores = await TrendScore.countDocuments();
    
    console.log('📊 Current state:');
    console.log(`   Posts: ${totalPosts} total, ${processedPosts} processed, ${otherPosts} in "other" category`);
    console.log(`   TrendScores: ${trendScores} documents\n`);

    // --- Step 2: Drop all TrendScore documents ---
    console.log('🗑️  Dropping all TrendScore documents...');
    const scoreResult = await TrendScore.deleteMany({});
    console.log(`   Deleted ${scoreResult.deletedCount} TrendScore docs\n`);

    // --- Step 3: Reset all processed flags ---
    console.log('🔄 Resetting processed flags on all TrendPosts...');
    const resetResult = await TrendPost.updateMany(
      {},
      { 
        $set: { processed: false },
        $unset: { 
          category: '', 
          topics: '', 
          painPoints: '', 
          sentiment: '', 
          demandSignal: '', 
          relevanceScore: '' 
        }
      }
    );
    console.log(`   Reset ${resetResult.modifiedCount} posts\n`);

    // --- Step 4: Run full analysis pipeline ---
    console.log('🚀 Running full analysis pipeline (this may take a few minutes)...');
    console.log('   Pre-filter → AI Relevance Gate → Deep Analysis → Aggregate\n');
    
    const result = await runFullAnalysis();
    
    console.log('\n📊 Results:');
    console.log(JSON.stringify(result, null, 2));

    // --- Step 5: Show new state ---
    const newProcessed = await TrendPost.countDocuments({ processed: true });
    const newOther = await TrendPost.countDocuments({ category: 'other' });
    const newIrrelevant = await TrendPost.countDocuments({ category: 'irrelevant' });
    const newScores = await TrendScore.countDocuments();
    
    const categoryCounts = await TrendPost.aggregate([
      { $match: { processed: true, category: { $nin: ['other', 'irrelevant', null] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n✅ New state:');
    console.log(`   Processed: ${newProcessed}`);
    console.log(`   "other": ${newOther}`);
    console.log(`   "irrelevant": ${newIrrelevant}`);
    console.log(`   TrendScores: ${newScores}`);
    console.log('\n   Category breakdown:');
    categoryCounts.forEach(c => console.log(`     ${c._id}: ${c.count}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
