// backend/scripts/ft_check.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  const idea = `"Idea: Food delivery just for late-night college towns;`;

  const messages = [
    { role: 'system', content: 'Return ONLY JSON in the taught schema.' },
    { role: 'user', content: idea }
  ];

  console.log('using model:', process.env.SIB_SCORER_MODEL);
  const resp = await client.chat.completions.create({
    model: process.env.SIB_SCORER_MODEL,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0
  });

  console.log('served by model:', resp.model);
  console.log('FT output:\n', resp.choices[0].message.content);
})();
