const fs = require("fs");
const path = require("path");

const target = process.argv[2] || "scores-v2.train.jsonl";
const filePath = path.join(__dirname, "..", "data", target);
const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(l => l.trim());

// Get system prompt from valid line 1
const sysPrompt = JSON.parse(lines[0]).messages[0].content;

// Collect valid lines
const validLines = [];
const brokenIndexes = [];
for (let i = 0; i < lines.length; i++) {
  try {
    JSON.parse(lines[i]);
    validLines.push(lines[i]);
  } catch (e) {
    brokenIndexes.push(i + 1);
  }
}
console.log("Valid lines:", validLines.length);
console.log("Broken lines:", brokenIndexes);

// 3 replacement examples
const newExamples = [
  {
    user: "A SaaS tool for small e-commerce businesses that automatically generates product descriptions and SEO-optimized content using AI based on product images and basic specifications.",
    assistant: {
      Originality: { score: 42, justification: "Copy.ai, Jasper, and Writesonic already do AI product descriptions. Shopify has built-in AI description tools. This is a narrower version of existing generalist tools without clear differentiation." },
      "Market Demand": { score: 64, justification: "Real pain for SMB e-commerce: writing descriptions for hundreds of SKUs is time-consuming. Merchants spend 15-30 min per product. However, existing AI writing tools already solve this. TAM around $800M but crowded." },
      "Technical Feasibility": { score: 91, justification: "Very straightforward: GPT-4 API for text generation, computer vision API for image analysis, basic CRUD for product specs. Can be built in 4-6 weeks with standard web stack. Zero technical risk." },
      "Barrier to Entry": { score: 22, justification: "Near-zero moat. Shopify could bundle this for free tomorrow. Copy.ai already includes this feature. No proprietary tech, zero switching cost, prompt engineering is not defensible." },
      "Monetization Potential": { score: 58, justification: "SMBs pay for Shopify ($29-299/mo), so willingness exists. Could charge $19-49/mo based on SKU count. But price pressure from free tiers of Jasper and Shopify native features makes margin hard." },
      Scalability: { score: 86, justification: "Pure SaaS with API-based generation. Near-zero marginal cost per customer. Main expense is LLM API calls but costs declining rapidly. Scales horizontally with standard cloud infrastructure." },
      "Regulatory & Legal Complexity": { score: 87, justification: "Minimal regulation: standard SaaS terms, GDPR for EU data, disclaimers about AI-generated content accuracy. Very straightforward compliance." },
      Overall: { score: 48, justification: "Technically easy but commercially weak. Market exists but saturated with better-funded alternatives. No clear wedge to differentiate or acquire customers cost-effectively. Would need specific vertical focus to compete." }
    }
  },
  {
    user: "A specialized recruiting platform for connecting remote-first tech startups with senior engineers (10+ years experience) who want to work 20-30 hours per week instead of full-time.",
    assistant: {
      Originality: { score: 68, justification: "Part-time senior eng market is underserved. TopTal, Gun.io, and Turing focus on full-time or hourly contractors, not structured part-time roles. The specific positioning of senior plus part-time plus startup-focused creates a niche." },
      "Market Demand": { score: 73, justification: "Real demand both sides: senior engineers want lifestyle flexibility after FAANG burnout, startups need expensive talent but cannot afford full-time. Estimated 200K+ senior engineers in US fit profile. TAM $2-4B." },
      "Technical Feasibility": { score: 94, justification: "Standard marketplace build: profile matching, job posts, application flow, messaging, payments. No novel tech required. Can use off-the-shelf tools like Stripe and Twilio. 2-3 month build." },
      "Barrier to Entry": { score: 56, justification: "Some moat from curated network once established but network effects are weak since talent is not exclusive. LinkedIn, Hired, or Toptal could add part-time senior roles filters easily." },
      "Monetization Potential": { score: 79, justification: "Clear revenue: 15-25% placement fee on annual comp (industry standard) or subscription $500-2000/mo. Senior eng part-time at $100K equals $15-25K per placement. Strong unit economics." },
      Scalability: { score: 71, justification: "Marketplace scales well digitally once liquidity achieved. Main cost is vetting candidates via manual interviews and customer support. Not pure SaaS margins but solid at critical mass." },
      "Regulatory & Legal Complexity": { score: 78, justification: "Moderate: must correctly classify workers W2 vs 1099, handle multi-state employment law, GDPR/CCPA for candidate data. If just connecting not employing, complexity drops significantly." },
      Overall: { score: 70, justification: "Strong niche opportunity with underserved market and clear pain on both sides. Main risks are achieving liquidity and defending against larger platforms. Smart positioning could win a defensible segment." }
    }
  },
  {
    user: "A peer-to-peer car rental platform for college campuses where students can rent each other's cars by the hour using a mobile app with keyless entry via Bluetooth.",
    assistant: {
      Originality: { score: 55, justification: "Turo already dominates P2P car rental. Zipcar and Getaround serve similar markets. The college campus angle is somewhat differentiated but Turo is available on campuses already. Keyless Bluetooth entry adds friction vs just meeting." },
      "Market Demand": { score: 52, justification: "College students do need occasional car access, but many campuses restrict parking and freshmen cannot have cars. Uber and Lyft solve most transport needs. TAM limited to students with cars willing to share, roughly $200-400M." },
      "Technical Feasibility": { score: 45, justification: "The Bluetooth keyless entry hardware is the hard part. Requires OBD-II device or aftermarket smart lock for each car. Hardware reliability, car compatibility, battery life all create risk. App is standard but hardware adds 6-12 months." },
      "Barrier to Entry": { score: 38, justification: "Turo could add campus-specific features trivially. No network effects unique to this platform. Hardware device could be copied. Only real barrier is campus-by-campus expansion which is also a weakness for scaling." },
      "Monetization Potential": { score: 46, justification: "Can charge 15-25% commission on rentals. But hourly rentals at college-friendly prices of $5-15/hr generate thin revenue. Average transaction $20, commission $4. Need massive volume. Price-sensitive users." },
      Scalability: { score: 35, justification: "Campus-by-campus expansion is capital-intensive and slow. Need critical mass of cars at each campus. Hardware installation creates per-unit cost. Geographic density requirement limits growth to sequential campus launches." },
      "Regulatory & Legal Complexity": { score: 32, justification: "Insurance is a major hurdle: personal auto policies exclude commercial use. Need specialized P2P rental insurance per state. Liability for accidents, parking violations, vehicle damage. University policies may prohibit this." },
      Overall: { score: 38, justification: "Turo already exists and works. Adding hardware complexity to serve a price-sensitive niche with thin margins and significant insurance hurdles is a tough path. Campus-by-campus scaling is slow and expensive." }
    }
  }
];

// Build new JSONL lines
const newLines = newExamples.map(ex => {
  return JSON.stringify({
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: ex.user },
      { role: "assistant", content: JSON.stringify(ex.assistant) }
    ]
  });
});

// Combine: 17 valid + 3 new = 20
const allLines = [...validLines, ...newLines];
fs.writeFileSync(filePath, allLines.join("\n") + "\n");
console.log("Wrote", allLines.length, "lines to", filePath);

// Final validation
const check = fs.readFileSync(filePath, "utf-8").split("\n").filter(l => l.trim());
let broken = 0;
check.forEach((l, i) => {
  try {
    const obj = JSON.parse(l);
    // Also validate structure
    if (!obj.messages || obj.messages.length !== 3) {
      console.log("BAD STRUCTURE line", i + 1);
      broken++;
    }
  } catch (e) {
    broken++;
    console.log("BROKEN line", i + 1, ":", e.message);
  }
});
if (broken === 0) {
  console.log("ALL", check.length, "LINES VALID with correct structure");
} else {
  console.log(broken, "lines still broken!");
}
