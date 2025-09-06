const { openai } = require('../services/openaiService');

const tasksAi = async (req, res) => {
  const { idea, userRequest } = req.body;

  const messages = [
    {
      role: 'system',
      content: `You are a professional assistant to an upcoming startup founder; your task is to take in a user's request to implement make or create something and then split this request into small actionable steps and assign them in the form of tasks. In the description section you will in details explain how the step should be done. Each step should be actionable specific telling the user exactly what to do and shouldn't be vague. Example of the required level of specificity:

If the user asks “Set up Stripe payments on my site”, you shouldn’t say:
“Integrate Stripe and test checkout.”
You should say:
“1) Go to https://dashboard.stripe.com
→ Create account → enable ‘Test mode’.
2) Dashboard → Developers → API keys → copy Publishable key and Secret key.
3) In your project root run npm i stripe @stripe/stripe-js (Node 18+).
4) Create pages/api/checkout_sessions.js with a POST handler that calls stripe.checkout.sessions.create({...}) for price price_XXXX.
5) In pages/index.js, add a ‘Buy’ button that fetches /api/checkout_sessions and redirects with stripe.redirectToCheckout({ sessionId }).
6) Start dev server npm run dev, open http://localhost:3000, click ‘Buy’, and pay with test card 4242 4242 4242 4242, any future date, any CVC, any ZIP.
Acceptance: order shows in Stripe → Payments (Test mode) with status ‘Succeeded’.”

You will recieve the user's idea and the user's requets. The user's idea is for context of what they are trying to build (you don't have to use this input if you don't need to) and the user's request is what you are actually gonna turn into step by step tasks as discussed above.

FOR THE assignedToName SECTION:
assignedToName: Use the same short project label (1–4 words) for all tasks in this response. If the user provides one, use it. Otherwise, derive it from the request (e.g., ‘Stripe Setup’, ‘Landing Page’, ‘MVP Backend’). Do not vary it per task.

VERY IMPORTANT DO NOT DO THIS, DO NOT CREATE ONE TASK AND HAVE ALL THE STEPS IN THE DESCRIPTION. INSTEAD EACH STEP SHOULD BE IN ITS OWN TASK

YOU MUST return ONLY a valid JSON object with this exact shape, NOTE YOU WILL PROVIDE THIS MULTIPLE TIMES DEPENDING ON HOW MANY TASKS YOU ARE MAKING:
{
"title": "<First write Step Number then The title of the task (in Markdown)>",
"description": "<details of the task what exactly should the user do (max 3 lines)>",
"assignedToName": "<name of this task set>",
} 
THIS SHOULD REPEAT FOR EACH STEP, VERY IMPORTANT THAT YOU DO THAT
`
    },
    {
      role: "system",
      content: `The user'request: ${JSON.stringify(userRequest)}`
    },
    {
      role: "system",
      content: `The user's idea, NOTE YOUR RESPONSE MUST BE JSON OBJECT: ${JSON.stringify(idea)}`
    },
  ];


  try {
    console.log('using model:', 'gpt-5-nano');

    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
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


module.exports = { tasksAi };
