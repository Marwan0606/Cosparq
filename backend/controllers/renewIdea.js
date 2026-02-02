const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const renewIdeaRes = require('../models/Renew-temporary-response')

const renewIdea = async (req, res) => {

  const userId = req.user.userId
  const { oldIdea, chatLogs, ideaId } = req.body;
  
  console.log('RenewIdea called - chatLogs length:', chatLogs ? chatLogs.length : 0);
  console.log('RenewIdea - chatLogs preview:', chatLogs ? chatLogs.substring(0, 300) : 'EMPTY');
  
  const renewResponse = await renewIdeaRes.create({userId, ideaId})
  console.log(renewResponse)

  // Build prompt based on whether we have chat logs
  const hasChatLogs = chatLogs && chatLogs.trim().length > 10;
  
  const messages = [
    {
      role: "system",
      content: hasChatLogs ? `
      You will receive the old idea and the chat history between you and the user. In the chat history, you and the user discussed features, improvements, and developments for the idea. Your job is to rewrite the idea incorporating ALL the improvements and features discussed in the chat logs.
      
      IMPORTANT: You MUST incorporate the changes from the chat logs. The new idea should reflect the discussions and improvements mentioned.
      
      You must return ONLY a valid JSON object. 
      Do not include markdown fences, code blocks, or any extra text.

      Required shape:
      {
        "idea": "<the improved, well-written idea incorporating all discussed changes as one string>"
      }

      Rules:
      - Exactly one top-level key: "idea".
      - The value is a single string (no nested objects or arrays).
      - No trailing commas.
      - No explanations or comments outside the JSON.
      - ALWAYS make meaningful improvements based on the chat logs.
      ` : `
      The user wants to improve their idea but has no chat history yet. Simply clean up and improve the writing of the idea, making it more professional and clear. Keep the core concept the same but enhance how it's expressed.
      
      You must return ONLY a valid JSON object.

      Required shape:
      {
        "idea": "<the polished, well-written idea as one string>"
      }
      `
    },
    {
      role: "user",
      content: 
      `
        ### OLD_IDEA
        ${typeof oldIdea === 'string' ? oldIdea : JSON.stringify(oldIdea)}

        ${hasChatLogs ? `### CHAT_HISTORY (last 15 interactions)
        ${chatLogs}` : '### NO CHAT HISTORY - Just polish the existing idea'}
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

    // Track API usage
    await trackApiUsage(userId, response, 'renewIdea');

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
