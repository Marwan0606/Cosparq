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


/**
 * Re-evaluate an idea with access to previous scores
 * AI is instructed to give a fresh, independent evaluation
 */
const reEvaluateIdea = async (req, res) => {
  const userId = req.user.userId;
  const { idea, ideaId, previousScores } = req.body;
  
  // Delete existing scoreboard response first
  await scoreboardResponseModel.findOneAndDelete({ ideaId });
  
  const scoreboardResponse = await scoreboardResponseModel.create({ userId, ideaId });
  console.log('Re-evaluation started:', scoreboardResponse);

  const messages = [
    {
      role: "system",
      content: `
You are a strict startup evaluator giving a FRESH, INDEPENDENT evaluation of a startup idea.

IMPORTANT: Evaluate the idea on its own merits as if seeing it for the first time. Your scores should reflect your honest assessment of THIS version of the idea. Don't anchor to previous scores - if the idea deserves a 75, give it a 75 regardless of what it scored before.

Output ONLY valid JSON (no code fences, no extra text) in this exact object shape:

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
- Provide FRESH justifications that may highlight different aspects or nuances.
- Output JSON object ONLY.
`
    },
    {
      role: "user",
      content: `Please evaluate this startup idea:

${idea}

Give your honest, independent assessment with fresh justifications.`
    }
  ];

  try {
    console.log('Re-evaluating idea with model:', process.env.SIB_SCORER_MODEL);

    const response = await openai.chat.completions.create({
      model: process.env.SIB_SCORER_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3 // Slightly higher for fresh perspective
    });

    console.log('served by model:', response.model);

    await trackApiUsage(userId, response, 'scoreboard-reevaluate');

    const reply = response.choices[0].message.content;

    const scoreboardUpdate = await scoreboardResponseModel.findOneAndUpdate(
      { userId, ideaId }, 
      { scoreboardResponse: reply, status: 'success' }, 
      { new: true, runValidators: true }
    );
    console.log('Re-evaluation complete:', scoreboardUpdate);

    res.json({ result: reply });
  } catch (err) {
    console.error('Re-evaluation error:', err);
    res.status(500).json({ error: 'Failed to re-evaluate idea.' });
  }
};


module.exports = { rateIdea, reEvaluateIdea };
