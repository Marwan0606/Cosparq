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
You are a strict, calibrated startup evaluator. Output ONLY valid JSON (no code fences, no extra text) in this exact object shape:

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

=== DETAILED SCORING RUBRIC ===

For each criterion, use these score bands. Pick the band that best fits, then fine-tune within that range.

--- ORIGINALITY (How novel is this idea?) ---
85-100: Truly novel concept with no direct competitors; creates a new category or fundamentally reimagines an existing one.
70-84: Significant differentiation from existing solutions; unique angle, technology, or business model that is hard to replicate.
50-69: Some differentiating features but core concept exists in market; incremental improvement over competitors.
30-49: Similar products already exist with minor variations; "me-too" product with cosmetic differences.
0-29: Exact clone of existing solution with no meaningful differentiation.

--- MARKET DEMAND (Is there real demand for this?) ---
85-100: Solves a critical, widespread pain point; target users actively spending money or significant time on workarounds. Large TAM ($10B+).
70-84: Clear problem with evidence of demand (existing spend, vocal complaints, growing search trends). TAM $1-10B.
50-69: Moderate problem; some users would find it useful but it's a "nice-to-have" not a "must-have". TAM $100M-1B.
30-49: Niche problem affecting a small audience; weak urgency or willingness to pay. TAM <$100M.
0-29: No clear problem being solved; solution looking for a problem.

--- TECHNICAL FEASIBILITY (How hard is it to build?) ---
85-100: Can be built with standard, proven tech stack by a small team in <3 months; no technical unknowns.
70-84: Achievable with available tech but requires solid engineering; 3-6 month build with a competent team.
50-69: Requires specialized expertise or integration of complex systems; 6-12 months; some technical risk.
30-49: Depends on immature or cutting-edge tech; significant R&D risk; 12+ months before viable product.
0-29: Requires breakthrough technology that doesn't reliably exist yet; extremely high technical risk.

--- BARRIER TO ENTRY (How defensible is the business?) ---
85-100: Strong moats: proprietary data, network effects, regulatory licenses, patents, or deep technical IP. Incumbents can't easily replicate.
70-84: Moderate moats: meaningful head start, specialized domain knowledge, strategic partnerships, or switching costs for users.
50-69: Some defensibility but competitors could replicate core offering within 6-12 months with sufficient resources.
30-49: Low barriers; any well-funded competitor could clone this quickly. Competing mainly on execution speed.
0-29: Zero defensibility; trivially replicable with no switching costs.

--- MONETIZATION POTENTIAL (Can this make money?) ---
85-100: Clear, proven revenue model in the space; strong willingness to pay; high LTV/CAC ratio expected; multiple revenue streams possible.
70-84: Viable revenue model with evidence from adjacent markets; reasonable price point ($X/mo that users already pay for similar tools).
50-69: Revenue model exists but unproven for this specific application; may require significant user base before monetizing.
30-49: Unclear monetization; users expect this type of product to be free; would need creative/indirect revenue models.
0-29: No realistic path to revenue; users won't pay and advertising/data models don't apply.

--- SCALABILITY (Can it grow efficiently?) ---
85-100: Digital product with near-zero marginal cost per user; viral or organic growth loops built into the product.
70-84: Scales well with standard cloud infrastructure; growth requires moderate incremental investment.
50-69: Scaling requires proportional increase in resources (support, operations, content); unit economics work but margins compress.
30-49: Scaling requires heavy human involvement, physical operations, or geographic expansion that is capital-intensive.
0-29: Fundamentally doesn't scale; revenue is linearly tied to human time or physical constraints.

--- REGULATORY & LEGAL COMPLEXITY (higher score = fewer hurdles) ---
85-100: No meaningful regulatory requirements; standard terms of service and privacy policy suffice.
70-84: Minor compliance needs (GDPR, basic data privacy); straightforward to handle with standard practices.
50-69: Moderate regulatory landscape; industry-specific compliance needed but well-documented and achievable.
30-49: Significant regulatory burden; requires legal counsel, licenses, or certifications that are costly and time-consuming.
0-29: Heavily regulated industry (healthcare, finance, government); extensive compliance, audits, and approvals required before launch.

--- OVERALL (Likelihood of success as pitched) ---
This is NOT a simple average. Weight it by real-world startup success factors:
- Market demand and monetization matter most (combined ~40% influence)
- Technical feasibility and barrier to entry (~30% influence)
- Originality and scalability (~20% influence)
- Regulatory complexity (~10% influence)
Also factor in: team feasibility for a small/solo founder, timing, and whether the pitch itself is clear and compelling.

=== RULES ===
- Evaluate each criterion INDEPENDENTLY — do not let one score influence another.
- Be brutally honest; do not sugarcoat. Most ideas are mediocre (50-65 range). Reserve 85+ for genuinely exceptional ideas.
- Each justification must cite SPECIFIC reasons (name competitors, cite market examples, reference tech requirements).
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

  // --- Rate limit: once per 24 hours per idea ---
  const existing = await scoreboardResponseModel.findOne({ userId, ideaId });
  if (existing && existing.lastReEvaluatedAt) {
    const hoursSinceLast = (Date.now() - new Date(existing.lastReEvaluatedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < 24) {
      const hoursRemaining = Math.ceil(24 - hoursSinceLast);
      return res.status(429).json({
        error: `You can only re-evaluate once every 24 hours.`,
        hoursRemaining,
        nextAvailableAt: new Date(new Date(existing.lastReEvaluatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  // Delete existing scoreboard response first
  await scoreboardResponseModel.findOneAndDelete({ ideaId });
  
  const scoreboardResponse = await scoreboardResponseModel.create({ userId, ideaId, lastReEvaluatedAt: new Date() });
  console.log('Re-evaluation started:', scoreboardResponse);

  const messages = [
    {
      role: "system",
      content: `
You are a strict, calibrated startup evaluator giving a FRESH, INDEPENDENT evaluation of a startup idea.

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

=== DETAILED SCORING RUBRIC ===

For each criterion, use these score bands. Pick the band that best fits, then fine-tune within that range.

--- ORIGINALITY (How novel is this idea?) ---
85-100: Truly novel concept with no direct competitors; creates a new category or fundamentally reimagines an existing one.
70-84: Significant differentiation from existing solutions; unique angle, technology, or business model that is hard to replicate.
50-69: Some differentiating features but core concept exists in market; incremental improvement over competitors.
30-49: Similar products already exist with minor variations; "me-too" product with cosmetic differences.
0-29: Exact clone of existing solution with no meaningful differentiation.

--- MARKET DEMAND (Is there real demand for this?) ---
85-100: Solves a critical, widespread pain point; target users actively spending money or significant time on workarounds. Large TAM ($10B+).
70-84: Clear problem with evidence of demand (existing spend, vocal complaints, growing search trends). TAM $1-10B.
50-69: Moderate problem; some users would find it useful but it's a "nice-to-have" not a "must-have". TAM $100M-1B.
30-49: Niche problem affecting a small audience; weak urgency or willingness to pay. TAM <$100M.
0-29: No clear problem being solved; solution looking for a problem.

--- TECHNICAL FEASIBILITY (How hard is it to build?) ---
85-100: Can be built with standard, proven tech stack by a small team in <3 months; no technical unknowns.
70-84: Achievable with available tech but requires solid engineering; 3-6 month build with a competent team.
50-69: Requires specialized expertise or integration of complex systems; 6-12 months; some technical risk.
30-49: Depends on immature or cutting-edge tech; significant R&D risk; 12+ months before viable product.
0-29: Requires breakthrough technology that doesn't reliably exist yet; extremely high technical risk.

--- BARRIER TO ENTRY (How defensible is the business?) ---
85-100: Strong moats: proprietary data, network effects, regulatory licenses, patents, or deep technical IP. Incumbents can't easily replicate.
70-84: Moderate moats: meaningful head start, specialized domain knowledge, strategic partnerships, or switching costs for users.
50-69: Some defensibility but competitors could replicate core offering within 6-12 months with sufficient resources.
30-49: Low barriers; any well-funded competitor could clone this quickly. Competing mainly on execution speed.
0-29: Zero defensibility; trivially replicable with no switching costs.

--- MONETIZATION POTENTIAL (Can this make money?) ---
85-100: Clear, proven revenue model in the space; strong willingness to pay; high LTV/CAC ratio expected; multiple revenue streams possible.
70-84: Viable revenue model with evidence from adjacent markets; reasonable price point ($X/mo that users already pay for similar tools).
50-69: Revenue model exists but unproven for this specific application; may require significant user base before monetizing.
30-49: Unclear monetization; users expect this type of product to be free; would need creative/indirect revenue models.
0-29: No realistic path to revenue; users won't pay and advertising/data models don't apply.

--- SCALABILITY (Can it grow efficiently?) ---
85-100: Digital product with near-zero marginal cost per user; viral or organic growth loops built into the product.
70-84: Scales well with standard cloud infrastructure; growth requires moderate incremental investment.
50-69: Scaling requires proportional increase in resources (support, operations, content); unit economics work but margins compress.
30-49: Scaling requires heavy human involvement, physical operations, or geographic expansion that is capital-intensive.
0-29: Fundamentally doesn't scale; revenue is linearly tied to human time or physical constraints.

--- REGULATORY & LEGAL COMPLEXITY (higher score = fewer hurdles) ---
85-100: No meaningful regulatory requirements; standard terms of service and privacy policy suffice.
70-84: Minor compliance needs (GDPR, basic data privacy); straightforward to handle with standard practices.
50-69: Moderate regulatory landscape; industry-specific compliance needed but well-documented and achievable.
30-49: Significant regulatory burden; requires legal counsel, licenses, or certifications that are costly and time-consuming.
0-29: Heavily regulated industry (healthcare, finance, government); extensive compliance, audits, and approvals required before launch.

--- OVERALL (Likelihood of success as pitched) ---
This is NOT a simple average. Weight it by real-world startup success factors:
- Market demand and monetization matter most (combined ~40% influence)
- Technical feasibility and barrier to entry (~30% influence)
- Originality and scalability (~20% influence)
- Regulatory complexity (~10% influence)
Also factor in: team feasibility for a small/solo founder, timing, and whether the pitch itself is clear and compelling.

=== RULES ===
- Evaluate each criterion INDEPENDENTLY — do not let one score influence another.
- Be brutally honest; do not sugarcoat. Most ideas are mediocre (50-65 range). Reserve 85+ for genuinely exceptional ideas.
- Each justification must cite SPECIFIC reasons (name competitors, cite market examples, reference tech requirements).
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
      temperature: 0.2 // Low for consistency on re-evaluation too
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
