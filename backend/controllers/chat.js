const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const ChatResponseModel = require('../models/Chat-response')
const RawChatResponseModel = require('../models/RawChat-responses')
const Users = require('../models/Users')
const { sanitizeString, maxLength, ensureString } = require('../middleware/sanitize');

const { marked } = require('marked');

const chat = async (req, res) => {

  const userInput = sanitizeString(maxLength(ensureString(req.body.userInput), 5000));
  const lastUserResponse = maxLength(ensureString(req.body.lastUserResponse), 10000);
  const lastAiResponse = maxLength(ensureString(req.body.lastAiResponse), 10000);
  const scoreboard = ensureString(req.body.scoreboard);
  const idea = maxLength(ensureString(req.body.idea), 10000);
  const ideaId = ensureString(req.body.ideaId);
  const userId = req.user.userId

  // Fetch user's name for personalized responses
  const userDoc = await Users.findById(userId).select('name displayName').lean();
  const userName = userDoc?.displayName || userDoc?.name || '';

  const chatResponse = await ChatResponseModel.create({userId, ideaId})
  //const RawChatResponse = await RawChatResponseModel.create({userId, ideaId})
  //console.log(chatResponse)
  //console.log(RawChatResponse)

  const messages = [
    {
      role: 'system',
      content: `You are a professional assistant to an upcoming startup founder; your task is to help and respond to the user, your tone is informative but also helpful and happy to help. Avoid fluff like "happy to help" or "please let me know if you have any more questions."

${userName ? `The user's name is ${userName}. You may address them by name occasionally. However, do NOT end your chat messages with sign-offs like "Best, ${userName}" or "Regards, ${userName}" — those are only appropriate when drafting emails or letters, not in conversation.` : ''}  
IMPORTANT NOTE: YOU MAY RECEIVE THE LAST USER RESPONSE AND YOU ANSWER IN A SUMMARY—THIS IS JUST THERE TO HELP YOU AND YOU SHOULD ONLY USE THE LAST USER RESPONSE AND YOUR LAST ANSWER IF THE USER ASKS A FOLLOW-UP QUESTION OR IF THESE MESSAGES ARE RELEVANT TO YOUR NEW RESPONSE; OTHERWISE YOU ARE NOT OBLIGATED TO USE THE OLDER MESSAGES GIVEN TO YOU IF NOT NEEDED. YOU WILL ALSO BE GIVEN THE SCOREBOARD FOR THE IDEA AND THE IDEA ITSELF—AGAIN, THIS IS JUST FOR YOUR REFERENCE; YOU DON'T NEED TO USE IT IF NOT NECESSARY.

    RESPONSE QUALITY RULES:
    - When relevant, make your response specific to the user's startup idea, scoreboard, and known context.
    - Avoid generic advice if you already have concrete context you can apply.
    - Only give a generic answer when the user's question is naturally generic.

**VERY IMPORTANT:**  
- **Always format your “reply” field in Markdown.**  
- Use **bold** for emphasis.  
- Use *italic* for subtle emphasis.  
- Wrap code examples in triple backticks:



YOU MUST return ONLY a valid JSON object with this exact shape:
{
"reply": "<what you would normally say to the user (in Markdown)>",
"user_summary": "<1–2 sentences summarizing what the user asked>",
"assistant_summary": "<1–2 sentences summarizing your response>"
}
`

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
    console.log('using model:', 'gpt-5-nano');

    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages,
      response_format: { type: 'json_object' },
      //temperature: 0.2
    });

    console.log('served by model:', response.model);

    // Track API usage
    await trackApiUsage(userId, response, 'chat');

    const reply = response.choices[0].message.content;
    //console.log(reply)

    let replyParsed = JSON.parse(reply)
    //console.log(replyParsed)

    /*
    console.log('AI response', replyParsed.reply)
    console.log('user Summary', replyParsed.user_summary)
    console.log('Ai Summary', replyParsed.user_summary)
    */

    console.log(userId)
    console.log(ideaId)
    const chatUpdate = await ChatResponseModel.findOneAndUpdate({userId, ideaId}, {userMessage:replyParsed.user_summary, AiResponse:replyParsed.assistant_summary, status:'success'}, {
      new: true,
      runValidators: true,
      sort: { createdAt: -1 }
    })
    //console.log(chatUpdate)

    const RawChatUpdate = await RawChatResponseModel.findOneAndUpdate({userId, ideaId}, {AiResponse:marked(replyParsed.reply), status:'success'}, {
      new: true,
      runValidators: true,
      sort: { createdAt: -1 }
    })
    //console.log(RawChatUpdate)



    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};


module.exports = { chat };
