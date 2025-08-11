require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  const idea = 'An AI that schedules study blocks based on syllabus deadlines.';
  const r = await client.chat.completions.create({
    model: process.env.SIB_SCORER_MODEL,
    messages: [
      { role: 'system', content: 'Return ONLY JSON in the taught schema.' },
      { role: 'user', content: idea }
    ],
    temperature: 0.2
  });
  console.log(r.choices[0].message.content);
})();
