const { openai } = require('../services/openaiService');

const chat = async (req, res) => {
  const { userInput, lastUserResponse, lastAiResponse, scoreboard, idea } = req.body;

  const messages = [
    {
      role: 'system',
      content: `You are an professional assistant to an upcoming startup founder, your task is to help and respond to the user, your tone is informative but also helpful and happy to help. Avoid fluff like "happy to help" or "please let me know if you have any more questions. Return ONLY valid JSON with this exact shape:
      {
        "reply": "<what you would normally say to the user>",
        "user_summary": "<1–2 sentences summarizing what the user asked>",
        "assistant_summary": "<1–2 sentences summarizing your response>"
      }
      Do not include any extra text.`
    },
    {
      role: "system",
      content: scoreboard
    },
    {
      role: "system",
      content: idea
    },
    /*
    {
      role: 'user',
      content: lastUserResponse
    },
    {
      role: 'assistant',
      content: lastAiResponse
    },
    */
    {
      role: 'user',
      content: userInput
    }
  ];

  if (lastUserResponse && lastAiResponse) {
    messages.push({ role: 'user', content: String(lastUserResponse) });
    messages.push({ role: 'assistant', content: String(lastAiResponse) });
  }

  try {
    console.log('using model:', 'gpt-4o-mini');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      //temperature: 0.2
    });

    console.log('served by model:', response.model);

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};


module.exports = { chat };
