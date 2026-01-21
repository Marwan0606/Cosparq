const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const scoreboardResponseModel = require('../models/Scoreboard-responses.js')

const rateIdea = async (req, res) => {

  const userId = req.user.userId
  const { idea, ideaId } = req.body;
  const scoreboardResponse = await scoreboardResponseModel.create({userId, ideaId})
  console.log(scoreboardResponse)

  const messages = [
    {
      role: "system",
      content: `
You are a strict startup evaluator. Output ONLY valid JSON (no code fences, no extra text) in this exact object shape:

{
  "Originality": { "score": <0-100>, "justification": "<10-100 words>" },
  "Market Demand": { "score": <0-100>, "justification": "<10-100 words>" },
  "Technical Feasibility": { "score": <0-100>, "justification": "<10-100 words>" },
  "Barrier to Entry": { "score": <0-100>, "justification": "<10-100 words>" },
  "Monetization Potential": { "score": <0-100>, "justification": "<10-100 words>" },
  "Scalability": { "score": <0-100>, "justification": "<10-100 words>" },
  "Regulatory & Legal Complexity": { "score": <0-100>, "justification": "<10-100 words>" },
  "Overall": { "score": <0-100>, "justification": "<10-100 words>" }
}

Scoring rubric (brief):
- Originality: novelty or unique improvements vs incumbents.
- Market Demand: problem prevalence, urgency, perceived value.
- Technical Feasibility: difficulty, required skills/tech, timeline.
- Barrier to Entry: incumbents, distribution moats, CAC, network effects.
- Monetization Potential: realistic pricing + willingness to pay.
- Scalability: growth without costs exploding.
- Regulatory & Legal Complexity: licenses, compliance, data/privacy.
- Overall: honest likelihood of success as pitched.

Rules:
- Replace ALL placeholders with real values; do NOT leave 0 or "" by default.
- A score of 0 is only allowed with a strong, explicit justification.
- Each "justification" must be 10–100 words (concise, specific, actionable).
- Be brutally honest; do not sugarcoat.
- Output JSON object ONLY.
`
    },
    {
      role: "user",
      content: idea
    }
  ];

  try {
    console.log('using model:', process.env.SIB_SCORER_MODEL);

    const response = await openai.chat.completions.create({
      model: process.env.SIB_SCORER_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    console.log('served by model:', response.model);

    // Track API usage
    await trackApiUsage(userId, response, 'scoreboard');

    const reply = response.choices[0].message.content;

    const scoreboardUpdate = await scoreboardResponseModel.findOneAndUpdate({userId, ideaId}, {scoreboardResponse:reply, status:'success'}, {
      new: true,
      runValidators: true,
    })
    console.log(scoreboardUpdate)

    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};



module.exports = { rateIdea };
