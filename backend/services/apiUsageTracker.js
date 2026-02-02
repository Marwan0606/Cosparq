// backend/services/apiUsageTracker.js
// Service to track OpenAI API usage and costs per user

const User = require('../models/Users');

// OpenAI pricing per 1K tokens (as of 2024 - update these as prices change)
// Prices in USD
const MODEL_PRICING = {
  // GPT-4o models
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-2024-11-20': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-search-preview': { input: 0.00015, output: 0.0006 },
  
  // GPT-4 models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  
  // GPT-3.5 models
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  
  // GPT-5 models (estimated pricing - update when official)
  'gpt-5-nano': { input: 0.0001, output: 0.0004 },
  'gpt-5': { input: 0.01, output: 0.03 },
  
  // Fine-tuned models - use base model pricing or custom
  // Add your fine-tuned model IDs here with their pricing
  
  // Default fallback pricing (conservative estimate)
  'default': { input: 0.01, output: 0.03 }
};

// Audio pricing (TTS and Whisper)
const AUDIO_PRICING = {
  // OpenAI TTS pricing per 1M characters
  'tts-1': 15.00 / 1000000,      // $15 per 1M chars = $0.000015 per char
  'tts-1-hd': 30.00 / 1000000,   // $30 per 1M chars = $0.000030 per char
  
  // Whisper pricing per minute
  'whisper-1': 0.006,            // $0.006 per minute
  
  // ElevenLabs pricing per 1K characters (more expensive, higher quality)
  // Starter tier: ~$0.30 per 1K characters, Creator: ~$0.24, Pro: ~$0.18
  // Using average estimate of $0.25 per 1K characters
  'elevenlabs-turbo-v2.5': 0.25 / 1000,     // ~$0.00025 per char
  'elevenlabs-multilingual-v2': 0.30 / 1000  // ~$0.00030 per char (slightly more expensive)
};

/**
 * Calculate the cost of an OpenAI API call
 * @param {string} model - The model name used
 * @param {number} promptTokens - Number of input/prompt tokens
 * @param {number} completionTokens - Number of output/completion tokens
 * @returns {number} Cost in USD
 */
const calculateCost = (model, promptTokens, completionTokens) => {
  // Find pricing for the model (check for partial matches for fine-tuned models)
  let pricing = MODEL_PRICING[model];
  
  if (!pricing) {
    // Check for partial matches (e.g., fine-tuned models contain base model name)
    for (const [modelKey, modelPricing] of Object.entries(MODEL_PRICING)) {
      if (model.includes(modelKey)) {
        pricing = modelPricing;
        break;
      }
    }
  }
  
  // Fall back to default if no match found
  if (!pricing) {
    console.warn(`Unknown model pricing for: ${model}, using default pricing`);
    pricing = MODEL_PRICING['default'];
  }
  
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  
  return inputCost + outputCost;
};

/**
 * Track API usage for a user after an OpenAI call
 * @param {string} userId - The user's ID
 * @param {object} response - The OpenAI API response object
 * @param {string} endpoint - The endpoint/feature name that made the call
 * @returns {Promise<object>} Updated user stats
 */
const trackApiUsage = async (userId, response, endpoint = 'unknown') => {
  try {
    if (!userId) {
      console.warn('⚠️ No userId provided to trackApiUsage');
      return null;
    }

    if (!response || !response.usage) {
      console.warn('⚠️ No usage data in OpenAI response');
      return null;
    }

    const { usage, model } = response;
    const { prompt_tokens, completion_tokens, total_tokens } = usage;
    
    // Calculate cost for this request
    const cost = calculateCost(model, prompt_tokens, completion_tokens);
    
    // Create usage record
    const usageRecord = {
      timestamp: new Date(),
      endpoint,
      model,
      promptTokens: prompt_tokens,
      completionTokens: completion_tokens,
      totalTokens: total_tokens,
      cost
    };

    // Update user document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          totalApiRequests: 1,
          totalApiCost: cost
        },
        $push: {
          apiUsageHistory: {
            $each: [usageRecord],
            $slice: -1000 // Keep only last 1000 records to prevent unbounded growth
          }
        }
      },
      { new: true }
    );

    if (updatedUser) {
      console.log(`📊 API Usage tracked for user ${userId}:`);
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Model: ${model}`);
      console.log(`   Tokens: ${total_tokens} (${prompt_tokens} in / ${completion_tokens} out)`);
      console.log(`   Cost: $${cost.toFixed(6)}`);
      console.log(`   Total requests: ${updatedUser.totalApiRequests}`);
      console.log(`   Total cost: $${updatedUser.totalApiCost.toFixed(4)}`);
    }

    return {
      requestCost: cost,
      totalRequests: updatedUser?.totalApiRequests || 0,
      totalCost: updatedUser?.totalApiCost || 0
    };
  } catch (error) {
    console.error('❌ Error tracking API usage:', error);
    // Don't throw - we don't want tracking errors to break the main functionality
    return null;
  }
};

/**
 * Track audio API usage (TTS and Whisper)
 * @param {string} userId - The user's ID
 * @param {string} model - The audio model used (tts-1, tts-1-hd, whisper-1)
 * @param {object} usage - Usage details { characters, durationMinutes }
 * @param {string} endpoint - The endpoint/feature name
 * @returns {Promise<object>} Updated user stats
 */
const trackAudioUsage = async (userId, model, usage, endpoint = 'audio') => {
  try {
    if (!userId) {
      console.warn('⚠️ No userId provided to trackAudioUsage');
      return null;
    }

    let cost = 0;
    let description = '';

    if (model.startsWith('tts')) {
      // TTS is billed per character
      const characters = usage.characters || 0;
      const pricePerChar = AUDIO_PRICING[model] || AUDIO_PRICING['tts-1'];
      cost = characters * pricePerChar;
      description = `${characters} chars`;
    } else if (model === 'whisper-1') {
      // Whisper is billed per minute
      const minutes = usage.durationMinutes || 0;
      cost = minutes * AUDIO_PRICING['whisper-1'];
      description = `${minutes.toFixed(2)} mins`;
    }

    // Create usage record
    const usageRecord = {
      timestamp: new Date(),
      endpoint,
      model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost
    };

    // Update user document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          totalApiRequests: 1,
          totalApiCost: cost
        },
        $push: {
          apiUsageHistory: {
            $each: [usageRecord],
            $slice: -1000
          }
        }
      },
      { new: true }
    );

    if (updatedUser) {
      console.log(`🔊 Audio Usage tracked for user ${userId}:`);
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Model: ${model}`);
      console.log(`   Usage: ${description}`);
      console.log(`   Cost: $${cost.toFixed(6)}`);
      console.log(`   Total requests: ${updatedUser.totalApiRequests}`);
      console.log(`   Total cost: $${updatedUser.totalApiCost.toFixed(4)}`);
    }

    return {
      requestCost: cost,
      totalRequests: updatedUser?.totalApiRequests || 0,
      totalCost: updatedUser?.totalApiCost || 0
    };
  } catch (error) {
    console.error('❌ Error tracking audio usage:', error);
    return null;
  }
};

/**
 * Get API usage stats for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<object>} User's API usage statistics
 */
const getUserApiStats = async (userId) => {
  try {
    const user = await User.findById(userId).select('totalApiRequests totalApiCost apiUsageHistory');
    
    if (!user) {
      return null;
    }

    // Calculate stats from history
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentUsage = user.apiUsageHistory || [];
    
    const stats = {
      totalRequests: user.totalApiRequests || 0,
      totalCost: user.totalApiCost || 0,
      last24h: {
        requests: recentUsage.filter(u => new Date(u.timestamp) > last24h).length,
        cost: recentUsage.filter(u => new Date(u.timestamp) > last24h).reduce((sum, u) => sum + u.cost, 0)
      },
      last7d: {
        requests: recentUsage.filter(u => new Date(u.timestamp) > last7d).length,
        cost: recentUsage.filter(u => new Date(u.timestamp) > last7d).reduce((sum, u) => sum + u.cost, 0)
      },
      last30d: {
        requests: recentUsage.filter(u => new Date(u.timestamp) > last30d).length,
        cost: recentUsage.filter(u => new Date(u.timestamp) > last30d).reduce((sum, u) => sum + u.cost, 0)
      },
      byEndpoint: {},
      byModel: {}
    };

    // Aggregate by endpoint and model
    for (const record of recentUsage) {
      // By endpoint
      if (!stats.byEndpoint[record.endpoint]) {
        stats.byEndpoint[record.endpoint] = { requests: 0, cost: 0, tokens: 0 };
      }
      stats.byEndpoint[record.endpoint].requests++;
      stats.byEndpoint[record.endpoint].cost += record.cost;
      stats.byEndpoint[record.endpoint].tokens += record.totalTokens;

      // By model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { requests: 0, cost: 0, tokens: 0 };
      }
      stats.byModel[record.model].requests++;
      stats.byModel[record.model].cost += record.cost;
      stats.byModel[record.model].tokens += record.totalTokens;
    }

    return stats;
  } catch (error) {
    console.error('❌ Error getting user API stats:', error);
    return null;
  }
};

module.exports = {
  trackApiUsage,
  trackAudioUsage,
  getUserApiStats,
  calculateCost,
  MODEL_PRICING,
  AUDIO_PRICING
};
