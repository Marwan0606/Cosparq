const { openai } = require('../services/openaiService');

const chat = async (req, res) => {
  const { userInput, lastUserResponse, lastAiResponse, scoreboard, idea } = req.body;

  const messages = [
    {
      role: 'system',
      content: `You are an professional assistant to an upcoming startup founder, your task is to help and respond to the user, your tone is informative but also helpful and happy to help. Avoid fluff like "happy to help" or "please let me know if you have any more questions. IMPORTANT NOTE YOU MAY RECIEVE THE LAST USER RESPONSE AND YOU ANSWER IN A SUMMARY, THIS IS JUST THERE TO HELP YOU AND YOU SHOULD ONLY USE THE LAST USER RESPONSE AND YOUR LAST ANSWER IF THE USER ASKS A FOLLOW UP QUESTION OR IF THESE MESSAGES ARE RELEVANT TO YOUR NEW RESPONSE, OTHERWISE YOU ARE NOT OBLIGATED TO USE THE OLDER MESSAGES GIVEN TO YOU IF NOT NEEDED. YOU WILL ALSO BE GIVEN THE SCOREBOARD FOR THE IDEA AND THE IDEA ITSELF AGAIN THIS IS JUST FOR YOUR REFERENCE YOU DON'T NEED TO USE IT IF NOT NECESSARY. VERY IMPORTANT: YOU MUST Return ONLY valid JSON Object with this exact shape:
      {
        "reply": "<what you would normally say to the user>",
        "user_summary": "<1–2 sentences summarizing what the user asked>",
        "assistant_summary": "<1–2 sentences summarizing your response>"
      }
      Do not include any extra text.`
    },
    {
      role: "system",
      content: `Scoreboard of the idea: ${JSON.stringify(scoreboard)}`
    },
    {
      role: "system",
      content: `The user's idea, NOTE YOUR RESPONSE MUST BE JSON OBJECT: ${JSON.stringify(idea)}`
    },
  ];
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
  if (lastUserResponse && lastAiResponse) {
    messages.push({ role: 'user', content: String(lastUserResponse) });
    messages.push({ role: 'assistant', content: String(lastAiResponse) });
  }
  messages.push({ role: 'user', content: userInput });



  try {
    console.log('using model:', 'gpt-4o-mini');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
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
