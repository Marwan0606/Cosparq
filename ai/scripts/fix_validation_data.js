const fs = require("fs");
const path = require("path");

const trainPath = path.join(__dirname, "..", "data", "scores-v2.train.jsonl");
const validPath = path.join(__dirname, "..", "data", "scores-v2.valid.jsonl");

// Get system prompt from valid training line
const sysPrompt = JSON.parse(fs.readFileSync(trainPath, "utf-8").split("\n")[0]).messages[0].content;

// Check which validation lines are valid
const validLines = [];
const lines = fs.readFileSync(validPath, "utf-8").split("\n").filter(l => l.trim());
lines.forEach((l, i) => {
  try {
    JSON.parse(l);
    validLines.push(l);
  } catch (e) {
    console.log("Dropping broken line", i + 1);
  }
});
console.log("Kept", validLines.length, "valid lines, need", 5 - validLines.length, "replacements");

// Replacement validation examples
const replacements = [
  {
    user: "A mobile soundboard app that lets users upload and share custom sound effects, organized into themed packs, with social features like following creators and trending sounds.",
    assistant: {
      Originality: { score: 28, justification: "Soundboard apps are saturated on both iOS and Android. Voicy, Blerp, and dozens of others do exactly this. Adding social features like following and trending is table stakes, not innovation. Custom upload exists in competitors already." },
      "Market Demand": { score: 35, justification: "Niche entertainment product. Sound effects are used occasionally in group chats or streams but not a daily need. No significant pain point being solved. TAM under $50M for standalone soundboard market. Most users expect free apps." },
      "Technical Feasibility": { score: 92, justification: "Trivially simple: audio file storage, playback, basic social graph, content feed. Standard mobile development with cloud storage. Can be built by one developer in 4-6 weeks. No technical risk whatsoever." },
      "Barrier to Entry": { score: 15, justification: "Zero moat. Hundreds of soundboard apps exist. No switching costs since sounds can be re-uploaded anywhere. No network effects strong enough to create lock-in. App store discovery is the only growth channel and it is saturated." },
      "Monetization Potential": { score: 25, justification: "Users expect soundboard apps to be free. Ad revenue on casual entertainment apps yields pennies. Premium sound packs could work but willingness to pay is extremely low. No proven $5+/mo subscription model in this category." },
      Scalability: { score: 78, justification: "Digital product scales well technically. Audio files are small, storage is cheap. However, content moderation becomes an issue at scale with user-uploaded audio. No organic growth loops beyond share-to-download." },
      "Regulatory & Legal Complexity": { score: 62, justification: "Copyright issues with sound effects from movies, TV, music. DMCA takedown process needed. User-generated content moderation required. Could face IP claims from entertainment companies if copyrighted sounds are uploaded." },
      Overall: { score: 27, justification: "Massively overcrowded category with no differentiation. Users will not pay for this, competitors are free and established. No defensible position. Building another soundboard app in 2026 is not a viable business opportunity." }
    }
  },
  {
    user: "A navigation app similar to Waze but specifically designed for truck drivers, incorporating real-time data on bridge heights, weight restrictions, truck-specific road closures, and optimal routes for oversized loads.",
    assistant: {
      Originality: { score: 72, justification: "While Waze and Google Maps dominate navigation, truck-specific routing is underserved by major players. Trucker Path and CoPilot Truck exist but have poor UX and limited real-time data. Combining Waze-style crowdsourcing with trucking constraints is a meaningful differentiator." },
      "Market Demand": { score: 78, justification: "3.5M truck drivers in the US alone face real danger from low bridges (causes $2B+ in damage annually) and weight-restricted roads. Fleets pay for routing software. TAM $2-5B including fleet management adjacent market. Strong willingness to pay for safety." },
      "Technical Feasibility": { score: 58, justification: "Requires comprehensive database of bridge heights, weight limits, and road restrictions across all US roads. This data is fragmented across state DOTs and not standardized. Real-time crowdsourcing adds complexity. 6-9 months with specialized mapping expertise." },
      "Barrier to Entry": { score: 64, justification: "Proprietary road restriction database becomes a moat over time. Crowdsourced data from truck drivers creates network effects. Google could enter but trucking is a niche they have historically underserved. First-mover with good data wins." },
      "Monetization Potential": { score: 82, justification: "Fleet operators pay $30-50/mo per truck for routing and compliance tools. Individual truckers pay $10-15/mo for premium apps. DAT and Trimble charge much more. Clear B2B and B2C revenue paths with proven willingness to pay in logistics." },
      Scalability: { score: 65, justification: "Software scales but data collection requires geographic density of truck drivers. US-first then expand internationally. Each country has different road restriction data formats. Fleet sales scale well but require sales team." },
      "Regulatory & Legal Complexity": { score: 72, justification: "Moderate: FMCSA compliance awareness helpful but app itself is not regulated. Liability concern if routing app directs truck to restricted road. Need strong disclaimers. DOT data access varies by state but is generally public." },
      Overall: { score: 72, justification: "Strong niche with real pain point and proven willingness to pay. Data moat is buildable. Main challenge is bootstrapping the road restriction database accurately. If data quality is high, this could capture significant market share from incumbent trucking apps." }
    }
  },
  {
    user: "An API-as-a-service platform that helps companies calculate and offset their carbon emissions by integrating with their cloud infrastructure, shipping providers, and payment systems to automatically track carbon footprint.",
    assistant: {
      Originality: { score: 62, justification: "Patch, Cloverly, and Watershed already offer carbon tracking APIs. However, the specific integration angle (cloud infra + shipping + payments in one unified API) is less common. Most competitors focus on one vertical. The bundled approach has some differentiation." },
      "Market Demand": { score: 68, justification: "ESG reporting is increasingly mandated (EU CSRD, SEC climate disclosure rules). Companies need automated carbon tracking. However, many see it as a compliance checkbox, not a priority. TAM $1-3B for carbon accounting software. Demand is regulation-driven, not organic." },
      "Technical Feasibility": { score: 70, justification: "Requires integrations with AWS/GCP/Azure billing APIs, shipping carrier APIs (FedEx, UPS), and payment processors. Carbon emission factors from EPA and IEA databases. Complex data normalization but no novel tech. 4-6 months for competent team." },
      "Barrier to Entry": { score: 48, justification: "Emission factor databases are public. API integrations are standard engineering work. Watershed raised $100M+ and has enterprise relationships. Competing against well-funded startups with head start. Switching costs are moderate once integrated." },
      "Monetization Potential": { score: 72, justification: "Usage-based API pricing works well (per API call or per metric ton tracked). Enterprise contracts at $2-10K/mo for compliance dashboards. Carbon offset marketplace adds transaction revenue. Multiple revenue streams possible." },
      Scalability: { score: 80, justification: "API-based product scales naturally with customer usage. Near-zero marginal cost per API call. Once integrations are built they serve all customers. Growth tied to enterprise sales cycle which is slower but high-value." },
      "Regulatory & Legal Complexity": { score: 55, justification: "Must stay current with evolving carbon accounting standards (GHG Protocol, SBTi). EU and US regulations are still changing. Carbon offset verification and quality is contentious. Need auditable methodology. Moderate ongoing compliance work." },
      Overall: { score: 61, justification: "Viable but entering a market with well-funded competitors like Watershed and Patch. The unified API angle is good but not enough alone. Would need to win on developer experience and pricing. Regulatory tailwinds help demand but the space is getting crowded." }
    }
  }
];

// Build replacement JSONL lines
const newLines = replacements.map(ex => {
  return JSON.stringify({
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: ex.user },
      { role: "assistant", content: JSON.stringify(ex.assistant) }
    ]
  });
});

// Combine valid + new
const allLines = [...validLines, ...newLines];
fs.writeFileSync(validPath, allLines.join("\n") + "\n");
console.log("Wrote", allLines.length, "lines");

// Final validation
const check = fs.readFileSync(validPath, "utf-8").split("\n").filter(l => l.trim());
let broken = 0;
check.forEach((l, i) => {
  try {
    const obj = JSON.parse(l);
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
  console.log("ALL", check.length, "LINES VALID");
}
