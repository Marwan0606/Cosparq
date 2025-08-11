// backend/services/openaiService.js
const OpenAI = require('openai');
//require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sendChatPrompt = async (messages) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

module.exports = {
  openai,
  sendChatPrompt
};
