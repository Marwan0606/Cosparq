const { openai } = require('../services/openaiService');
const renewIdeaRes = require('../models/Renew-temporary-response')

const renewIdea = async (req, res) => {

  const userId = req.user.userId
  const { oldIdea, chatLogs, ideaId } = req.body;
  const renewResponse = await renewIdeaRes.create({userId, ideaId})
  console.log(renewResponse)

  const messages = [
    {
      role: "system",
      content: `
      You will receive the old idea and a summary of the last 20 chatlogs you had with the user, you will probably notice that within the chatlogs you and the user discussed a number of new features and developments of the idea essentially making the initial idea better and developing the idea. Your whole job is to just rewrite the idea again but it should be way better and more developed and the developments should be based on what the AI and the user discussed in the chatlogs, YOU SHOULDN'T COME UP WITH ENTIRELY NEW IDEAS NOT DISCUSSED WITH USER. You MUST ANSWER IN VALID JSON OBJECT, ONLY WRITING THE IDEA AND NO EXTRA TEXT OR EXPLANATIONS.

      You must return ONLY a valid JSON object. 
      Do not include markdown fences, code blocks, or any extra text.

      Required shape:
      {
        "idea": "<a single improved, well-written idea as one string>"
      }

      Rules:
      - Exactly one top-level key: "idea".
      - The value is a single string (no nested objects or arrays).
      - No trailing commas.
      - No explanations or comments outside the JSON.
      `
    },
    {
      role: "user",
      content: 
      `
        ### OLD_IDEA
        ${typeof oldIdea === 'string' ? oldIdea : JSON.stringify(oldIdea)}

        ### CHAT_LOGS_SUMMARY (last 20 turns)
        ${typeof chatLogs === 'string' ? chatLogs : JSON.stringify(chatLogs)}
      `
    },
  ];

  try {
    console.log('using model:', 'gpt-5-nano');

    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages,
      //temperature: 0.2
    });

    console.log('served by model:', response.model);

    const reply = response.choices[0].message.content;

    const renewUpdate = await renewIdeaRes.findOneAndUpdate({userId, ideaId}, {renewIdeaResponse:reply, status:'success'}, {
      new: true,
      runValidators: true,
    })
    console.log(renewUpdate)
  

    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};



module.exports = { renewIdea };
