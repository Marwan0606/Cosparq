const { openai } = require('../services/openaiService');

const actionPlan = async (req, res) => {
  const { idea } = req.body;

  const messages = [
    {
      role: "system",
      content: `Action Plan Page — System Prompt
You are a startup expert. Given a startup idea you will do the following while being precise, practical, realistic and honest:

1. Rewrite the idea in a clean, comprehensive, easy to understand and well written way, make sure everything is included in the idea, DONT MAKE UP STUFF THAT WAS NEVER IN THE IDEA, DONT HALLUCINATE.

2. State the main MVP features that would need to be built done for this startup idea, max 10 features.

3. State the recommended tech stack

4. Create a full comprehensive X (you will choose how many weeks) amount of weeks timeline from 0 to MVP. You have to be really specific and your timeline must be specific to the idea and not just a generic timeline also you must be realistic

5. For EACH timeline step, include a short list of concrete, implementation-level details that are specific to the given idea (these will power tooltips). These must be actionable tasks (e.g., “Design DB schema: users, sessions, subscriptions”, “Implement POST /api/v1/auth/login with rate-limit”, “Draft landing hero copy + CTA variants”), not generic advice.


Output rules
Return ONLY valid JSON matching the schema below. No code fences, no extra text.
Use integers for numeric fields that are percentages (no "%" symbol).
Currency assumptions: USD; pricing listed as ranges per month unless noted.
Keep strings concise; bullets should be short phrases.

Return ONLY JSON per the schema below. Do not include backticks or explanations.

{
  "concept": {
    "title": "Your Startup Concept",
    "summary": "string"
  },
  "mvp": {
    "features": ["string"]
  },
  "tech_stack": {
    "frontend": ["string"],
    "backend": ["string"],
    "infrastructure": ["string"]
  },
  "timeline": {
    "label": "<Number>-Week Launch Timeline",
    "steps": [
      {
        "step": 1,
        "title": "string",
        "timeframe": "string",
        "priority": "High | Medium | Low",
        "details": ["string"]   // 3–8 highly specific, actionable bullets for this exact idea
      }
    ]
  }
}  
      
      `
    },
    {
      role: "user",
      content: idea
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages,
      //temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { actionPlan };
