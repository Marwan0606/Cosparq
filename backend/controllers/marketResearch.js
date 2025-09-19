const { openai } = require('../services/openaiService');
const marketResearchResponseModel = require('../models/Market-responses')

const marketResearch = async (req, res) => {

  const userId = req.user.userId
  const { idea, ideaId } = req.body;
  const marketResearchResponse = await marketResearchResponseModel.create({userId, ideaId})
  console.log(marketResearchResponse)

  const messages = [
    {
      role: "system",
      content: `
      Market Research — System Prompt
      You are a startup market analyst. Given a startup idea, produce a compact, decision-oriented market research pack to fill UI panels. Be precise, practical, and honest; do not sugarcoat risks.

      What to do
      Identify the top 5 competitors (prioritize direct competitors). For each, estimate how directly they compete, and their market dominance/share based on public signals (brand reach, traffic, brand recall, funding, user count, reviews, app ranks, etc.).

      Describe the target audience & market size (TAM/SAM/SOM) and growth trends.

      Summarize monetization models & pricing benchmarks, willingness to pay, and expected margins.

      Outline distribution & acquisition: best channels, CAC/LTV/payback benchmarks, and red flags.

      Give a Competition Feasibility score (0–100) reflecting how likely the idea can compete as pitched; add a brief rationale, where to wedge in, and the main risks.

      When possible, include source links (max 8), each to a credible page. If you cannot verify something, infer it but be conservative.

      Output rules
      Return ONLY valid JSON matching the schema below. No code fences, no extra text.

      Use integers for numeric fields that are percentages (no "%" symbol).

      Currency assumptions: USD; pricing listed as ranges per month unless noted.

      Keep strings concise; bullets should be short phrases.

      Length limits:

      summary (Competition Feasibility): ≤ 80 words

      Any single string field: ≤ 200 characters

      If something is uncertain, add “(est.)”.

      How to compute “directness_pct”
      100 = same job-to-be-done, same target segment.

      70–90 = same core problem, different niche/segment.

      40–60 = adjacent solution customers could switch to.

      10–30 = indirect substitute.

      How to classify “dominance”
      Use one of: Very High, High, Medium, Low based on brand power + distribution + lock-in + capital.

      JSON schema (return exactly this shape and key names)
      {
      "competitors": {
      "top5": [
      {
      "name": "string",
      "url": "string",
      "type": "Direct | Adjacent | Indirect",
      "directness_pct": 0,
      "market_share_pct_est": 0,
      "dominance": "Very High | High | Medium | Low",
      "notes": "string"
      }
      ],
      "dominance_alerts": [
      "string"
      ]
      },
      "audience_market": {
      "target_demographics": [
      "string"
      ],
      "market_size": {
      "TAM": "string", // e.g., "~2–3M users/yr (est.)"
      "SAM": "string",
      "SOM": "string"
      },
      "growth_trends": [
      "string"
      ]
      },
      "monetization_pricing": {
      "models": [
      "Freemium",
      "Pro/Team Subscription",
      "Usage Add-ons",
      "One-off Reports"
      ],
      "pricing_benchmarks": {
      "individuals": "$12–$29/mo",
      "teams": "$49–$149/mo",
      "add_ons": "$9–$39/run",
      "one_offs": "$5–$29"
      },
      "willingness_to_pay": "string",
      "expected_margins": {
      "gross_margin_pct_range": "75–85%",
      "cac_payback": "1–3 months",
      "churn_sensitivity": "string"
      }
      },
      "distribution_acquisition": {
      "primary_channels": [
      "SEO (problem queries)",
      "Content & Guides",
      "Founder social (Twitter/LinkedIn)",
      "Partnerships",
      "Communities"
      ],
      "benchmarks": {
      "CAC_self_serve_usd": "$18–$55",
      "LTV_to_CAC": "3–6x",
      "payback_period": "1–3 months",
      "free_to_paid_conv_pct": "4–10%"
      },
      "red_flags": [
      "string"
      ]
      },
      "competition_feasibility": {
      "score_0_100": 0,
      "label": "Exceptional | Excellent | Very Good | Good | Fair | Weak | Critical",
      "summary": "string",
      "why_you_can_win": [
      "string"
      ],
      "risks": [
      "string"
      ]
      },
      "source_links": [
      { "title": "string", "url": "string" }
      ]
      }

      Return ONLY JSON per the schema.
      For deciding the overall score for chance to compete you can use the key below
          {
      "score_label_key": [
        {"range": "97-100", "label": "Runway Clear"},
        {"range": "90-96",  "label": "Strong Advantage"},
        {"range": "80-89",  "label": "Good Shot"},
        {"range": "70-79",  "label": "Workable with Focus"},
        {"range": "50-69",  "label": "Uphill Battle"},
        {"range": "0-49",   "label": "Non-Starter (as pitched)"}
      ]
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
      model: "gpt-4o-mini-search-preview",
      messages,
      //temperature: 0.7
    });

    const reply = response.choices[0].message.content;

    const marketUpdate = await marketResearchResponseModel.findOneAndUpdate({userId, ideaId}, {marketResearchResponse:reply, status:'success'}, {
      new: true,
      runValidators: true,
    })
    console.log(marketUpdate)

    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { marketResearch };
