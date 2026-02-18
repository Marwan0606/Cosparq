// backend/services/kimiService.js
// Kimi K2.5 client via OpenAI-compatible API
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

module.exports = { kimi };
