const fs = require('fs');
const path = require('path');

// System prompt (matches scoreboard.js exactly)
const systemPrompt = `You are a strict, calibrated startup evaluator. Output ONLY valid JSON (no code fences, no extra text) in this exact object shape:

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
- Output JSON object ONLY.`;

// Additional training examples
const trainingExamples = [
  {
    idea: "A Chrome extension that automatically fills out job applications by scraping your LinkedIn profile and resume, then applies to hundreds of jobs per day with one click.",
    response: {
      "Originality": { "score": 34, "justification": "LazyApply, Simplify, and Sonara already do automated job applications. Chrome extensions for autofill exist (Teal, Simplify). This is a direct clone of an existing, somewhat controversial product category with no differentiation mentioned." },
      "Market Demand": { "score": 71, "justification": "Real pain: job seekers apply to 50-200 jobs before landing interviews. Manual applications take 20-45 min each. TAM is $3-5B in job search tools globally. However, quality vs quantity is debated—mass applications often get filtered out." },
      "Technical Feasibility": { "score": 89, "justification": "Straightforward browser extension: DOM manipulation for form filling, LinkedIn API or scraping for profile data, storage for resume parsing. Can be built in 4-6 weeks with web dev experience. Minimal technical risk." },
      "Barrier to Entry": { "score": 18, "justification": "Zero moat. LazyApply, Simplify, and Job Copilot already dominate. Extension logic is trivial to replicate. No network effects, no proprietary data. Pure commodity with race-to-bottom pricing." },
      "Monetization Potential": { "score": 52, "justification": "Freemium model exists: free for X applications/month, $10-30/mo for unlimited. LazyApply charges $99 one-time. Some willingness to pay but price sensitivity is high since job seekers are often unemployed." },
      "Scalability": { "score": 92, "justification": "Pure client-side extension scales perfectly with near-zero server costs. Optional cloud sync adds minimal infrastructure. Distribution via Chrome Web Store is automated. Excellent scalability from technical standpoint." },
      "Regulatory & Legal Complexity": { "score": 65, "justification": "Moderate concerns: some job boards (Indeed, LinkedIn) prohibit automated applications in ToS, risk of account bans. No legal regulation but risk of being blocked by platforms. Need disclaimers about ToS violations." },
      "Overall": { "score": 44, "justification": "Technically easy and some demand exists, but saturated market with entrenched competitors. Ethical concerns about spam applications hurt brand. Platforms actively fight automation. Limited differentiation path makes success unlikely without unique angle." }
    }
  },
  {
    idea: "An app that gamifies household chores for families, awarding points and badges to kids when they complete tasks, with a leaderboard and rewards system parents can customize.",
    response: {
      "Originality": { "score": 28, "justification": "OurHome, Homey, ChoreMonster, and S'moresUp already do gamified chore tracking for families. The leaderboard + points + badges model is identical to multiple established apps. No novel features or differentiation described." },
      "Market Demand": { "score": 48, "justification": "Niche problem: parents want kids to do chores, but most families resort to traditional methods (allowance, grounding). Limited urgency—nice-to-have not must-have. TAM <$80M for family productivity apps. Short-lived engagement typical." },
      "Technical Feasibility": { "score": 96, "justification": "Trivial mobile app: task lists, point tracking, badge system, simple leaderboard. Standard React Native or Flutter build. Backend is basic CRUD with family group management. 3-4 weeks build time. Zero technical unknowns." },
      "Barrier to Entry": { "score": 10, "justification": "No barriers. Open-source alternatives exist. Any developer could build this in a month. No data moat, no network effects (families don't interact across households). Purely execution-based competition with established apps." },
      "Monetization Potential": { "score": 41, "justification": "Weak willingness to pay: users expect this free (many ad-supported versions exist). Freemium with $2.99/mo premium or $9.99 one-time might convert 1-2% of free users. Small LTV, high churn as kids age out." },
      "Scalability": { "score": 91, "justification": "Pure digital mobile app with near-zero marginal costs. Cloud database for family data scales trivially. Distribution through app stores. Excellent technical scalability; challenge is user acquisition and retention." },
      "Regulatory & Legal Complexity": { "score": 84, "justification": "Minimal regulation: COPPA compliance for users under 13 (parental consent, data privacy), standard app store policies, basic ToS. Well-documented requirements, straightforward to implement." },
      "Overall": { "score": 32, "justification": "Low-value market with weak monetization, entrenched free alternatives, and no defensibility. Even with perfect execution, TAM is too small and churn too high to build a sustainable business. Better as a feature within a larger parenting app." }
    }
  },
  {
    idea: "A B2B platform that connects licensed pharmacists with pharmaceutical companies for virtual consulting on drug development, regulatory compliance, and clinical trial design.",
    response: {
      "Originality": { "score": 65, "justification": "Expert networks like GLG and AlphaSights connect pharma companies with consultants, but aren't pharmacy-specific. Kolabtree offers scientific consulting broadly. The vertical focus on licensed pharmacists for pharma consulting is moderately differentiated." },
      "Market Demand": { "score": 76, "justification": "Real demand: pharma companies spend $180B+ annually on R&D, including regulatory consulting. Pharmacists have specialized knowledge for clinical trials and compliance. TAM is $4-6B for pharma consulting services. Clear, validated need." },
      "Technical Feasibility": { "score": 87, "justification": "Standard marketplace: consultant profiles with credential verification (pharmacy license check via state boards), project posting, video conferencing (Zoom API), payment processing. 3-4 month build with standard stack. No technical hurdles." },
      "Barrier to Entry": { "score": 58, "justification": "Some moat from credential vetting and relationships with pharmacy schools for recruiter. However, GLG or Guidepoint could add pharmacy vertical easily. Switching costs exist once companies have preferred consultants, but not insurmountable." },
      "Monetization Potential": { "score": 81, "justification": "Clear B2B model: take 20-30% commission on consulting fees ($200-500/hr is standard for pharma consultants), or charge pharma companies subscription for access. Strong unit economics, proven in adjacent expert network markets." },
      "Scalability": { "score": 68, "justification": "Marketplace scales digitally but requires ongoing consultant recruitment and vetting (manual). Quality control for expert matching needs human oversight. Scales better than pure services but not pure SaaS margins." },
      "Regulatory & Legal Complexity": { "score": 58, "justification": "Moderate burden: ensure pharmacists are licensed and in good standing (verify with state boards), handle NDA/IP agreements properly, potential HIPAA if discussing patient data, standard B2B contracts. Legal counsel recommended." },
      "Overall": { "score": 69, "justification": "Solid B2B opportunity with real demand and clear monetization. Main challenges are competing with generalist expert networks (GLG has huge networks and brand), achieving consultant liquidity, and sales cycle length in pharma. Viable with good execution and pharma relationships." }
    }
  }
];

// Write additional examples to file
const outputPath = path.join(__dirname, '../data/scores-v2.train.jsonl');
const writeStream = fs.createWriteStream(outputPath, { flags: 'a' });

trainingExamples.forEach(example => {
  const jsonLine = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: example.idea },
      { role: "assistant", content: JSON.stringify(example.response) }
    ]
  };
  writeStream.write(JSON.stringify(jsonLine) + '\n');
});

writeStream.end();
console.log(`Added ${trainingExamples.length} training examples to ${outputPath}`);
