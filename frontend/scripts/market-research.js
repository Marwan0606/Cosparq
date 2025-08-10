const marketBoard = async (idea)=>{
  try {
    let response = ''

    if (localStorage.getItem('response-research')) { //I THINK THERES A BUG THATS GONNA HAPPEN HERE BECAUSE WE NEVER CLEAR LOCAL STORAGE
      response = JSON.parse(localStorage.getItem('response-research'))
    } else {
      response = await axios.post('/api/research', {
        idea: idea
      });
    }


/*
    let response = {
  "competitors": {
    "top5": [
      {
        "name": "Daylio",
        "url": "https://en.wikipedia.org/wiki/Daylio",
        "type": "Direct",
        "directness_pct": 90,
        "market_share_pct_est": 25,
        "dominance": "High",
        "notes": "Offers mood tracking with customizable icons and activity logging; lacks AI-driven activity suggestions and interactive visualizations."
      },
      {
        "name": "GuudMind",
        "url": "https://apps.apple.com/us/app/guudmind-smart-mood-tracker/id6472091590",
        "type": "Direct",
        "directness_pct": 85,
        "market_share_pct_est": 15,
        "dominance": "Medium",
        "notes": "Provides AI-powered mood analysis and journaling; does not feature interactive world map visualizations."
      },
      {
        "name": "MindSync",
        "url": "https://www.mindsync.app/",
        "type": "Direct",
        "directness_pct": 80,
        "market_share_pct_est": 10,
        "dominance": "Medium",
        "notes": "Focuses on voice journaling and AI-driven mood tracking; lacks interactive visualizations and activity suggestions."
      },
      {
        "name": "Bear Room",
        "url": "https://www.techradar.com/computing/websites-apps/bear-room",
        "type": "Indirect",
        "directness_pct": 60,
        "market_share_pct_est": 5,
        "dominance": "Low",
        "notes": "Offers stress relief techniques and soothing soundscapes; does not provide mood tracking or activity suggestions."
      },
      {
        "name": "Joy",
        "url": "https://apnews.com/article/4136f37269a175304e0b8953e523bbe5",
        "type": "Indirect",
        "directness_pct": 50,
        "market_share_pct_est": 5,
        "dominance": "Low",
        "notes": "AI-based app for emotional support; lacks mood tracking and activity suggestion features."
      }
    ],
    "dominance_alerts": [
      "High competition from established mood tracking apps with significant user bases."
    ]
  },
  "audience_market": {
    "target_demographics": [
      "Individuals seeking mental health support",
      "Users interested in mood tracking and self-improvement",
      "Tech-savvy individuals comfortable with AI-driven applications"
    ],
    "market_size": {
      "TAM": "~500M users globally (est.)",
      "SAM": "~100M users in the U.S. (est.)",
      "SOM": "~10M users in the U.S. (est.)"
    },
    "growth_trends": [
      "Increasing adoption of mental health apps",
      "Rising interest in AI-driven wellness solutions",
      "Growing awareness of the importance of mental well-being"
    ]
  },
  "monetization_pricing": {
    "models": [
      "Freemium",
      "Subscription",
      "In-app Purchases"
    ],
    "pricing_benchmarks": {
      "individuals": "$5–$15/mo",
      "teams": "$20–$50/mo",
      "add_ons": "$1–$5/run",
      "one_offs": "$2–$10"
    },
    "willingness_to_pay": "Users are generally willing to pay for premium features that offer personalized insights and enhanced functionality.",
    "expected_margins": {
      "gross_margin_pct_range": "70–80%",
      "cac_payback": "3–6 months",
      "churn_sensitivity": "High; user engagement is crucial for retention."
    }
  },
  "distribution_acquisition": {
    "primary_channels": [
      "App Store Optimization (ASO)",
      "Social Media Marketing",
      "Influencer Partnerships",
      "Content Marketing (blogs, podcasts)",
      "Referral Programs"
    ],
    "benchmarks": {
      "CAC_self_serve_usd": "$10–$30",
      "LTV_to_CAC": "3–5x",
      "payback_period": "3–6 months",
      "free_to_paid_conv_pct": "5–15%"
    },
    "red_flags": [
      "High user acquisition costs due to competitive app market",
      "Potential privacy concerns with sensitive user data"
    ]
  },
  "competition_feasibility": {
    "score_0_100": 70,
    "label": "Workable with Focus",
    "summary": "While the market is competitive with established players, a unique value proposition combining AI-driven activity suggestions and interactive mood visualizations can attract users seeking innovative mental health solutions.",
    "why_you_can_win": [
      "Unique combination of AI-driven activity suggestions and interactive visualizations",
      "Growing demand for personalized mental health support"
    ],
    "risks": [
      "High competition from established apps with large user bases",
      "User acquisition challenges in a crowded market"
    ]
  },
  "source_links": [
    { "title": "Daylio - Wikipedia", "url": "https://en.wikipedia.org/wiki/Daylio" },
    { "title": "GuudMind: Smart Mood Tracker on the App Store", "url": "https://apps.apple.com/us/app/guudmind-smart-mood-tracker/id6472091590" },
    { "title": "MindSync | Easy Journaling App with AI for Mood & Behavior tracking", "url": "https://www.mindsync.app/" },
    { "title": "Bear Room - TechRadar", "url": "https://www.techradar.com/computing/websites-apps/bear-room" },
    { "title": "Joy app developed by Parkland school shooting survivor", "url": "https://apnews.com/article/4136f37269a175304e0b8953e523bbe5" },
    { "title": "Best Mood Tracker Apps of 2023 - Verywell Mind", "url": "https://www.verywellmind.com/best-mood-tracker-apps-5212922" },
    { "title": "AI Apps for Health and Wellness in 2025: 10 Tools to Improve Your Life", "url": "https://www.aiapps.com/blog/ai-apps-for-health-and-wellness-in-2025-10-tools-to-improve-your-life/" },
    { "title": "Best Mood Tracker Apps in 2025: Features & Comparisons – Lume Journal App", "url": "https://lumejournalapp.com/the-best-mood-tracker-apps-in-2025/" }
  ]
} 
*/
    console.log(response);
    
    localStorage.setItem('response-research', JSON.stringify(response));

    //const mr = JSON.parse(response.data.result);

    //const resultData = JSON.parse(response.result);

    let HTML = ``

    function generateMarketHTML() {
      HTML += `
<section class="panel g-monetization">
  <div class="panel-head">
    <h2 class="panel-title">Monetization & Pricing Insights</h2>
  </div>
  <div class="rows">
    <div class="row" data-tip-title="Revenue Models" data-tip-body="How you make money. Examples: subscriptions, usage-based pricing, one-time licenses, ads, marketplace take rates. Pick a model that matches how users get value and supports healthy CAC/LTV.">
      <strong>Popular Models</strong>
      <div class="tags">
        ${response.monetization_pricing.models.map(m => `<span class="tag">${m}</span>`).join('')}
      </div>
    </div>

    <div class="row" data-tip-title="Price Benchmarks" data-tip-body="What competitors charge today. Use as an anchor for initial tests—not a rule. Helps position your value, set price experiments, and estimate early revenue.">
      <strong>Pricing Benchmarks</strong>
      <ul class="bullets">
        <li><strong>Individuals:</strong> ${response.monetization_pricing.pricing_benchmarks.individuals}</li>
        <li><strong>Teams:</strong> ${response.monetization_pricing.pricing_benchmarks.teams}</li>
        <li><strong>Add-ons:</strong> ${response.monetization_pricing.pricing_benchmarks.add_ons}</li>
        <li><strong>One-offs:</strong> ${response.monetization_pricing.pricing_benchmarks.one_offs}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Willingness to Pay" data-tip-body="Estimated amount target users will pay given perceived value and ROI (time saved, revenue unlocked, risk reduced). Validate via surveys, interviews, and live pricing tests.">
      <strong>Willingness to Pay (WTP)</strong>
      <p class="muted">${response.monetization_pricing.willingness_to_pay}</p>
    </div>

    <div class="row" data-tip-title="Gross Margins" data-tip-body="Revenue minus direct variable costs. Higher gross margin (e.g., 70–90%) leaves room for CAC, support, and profit—key for scalable software businesses. Watch paid APIs and other variable costs.">
      <strong>Expected Margins</strong>
      <div class="tags">
        <span class="tag tag-okay">${response.monetization_pricing.expected_margins.gross_margin_pct_range} GM</span>
        <span class="tag">CAC payback: ${response.monetization_pricing.expected_margins.cac_payback}</span>
        <span class="tag">Churn: ${response.monetization_pricing.expected_margins.churn_sensitivity}</span>
      </div>
    </div>
  </div>
</section>

<section class="panel g-audience">
  <div class="panel-head">
    <h2 class="panel-title">Target Audience & Market Size</h2>
  </div>
  <div class="rows">
    <div class="row" data-tip-title="Personas" data-tip-body="Who buys and uses the product. Define by role, problems, budget, and triggers. Clear personas focus messaging, features, and acquisition channels.">
      <strong>Target Demographics</strong>
      <ul class="bullets">
        ${response.audience_market.target_demographics.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>

    <div class="row" data-tip-title="TAM/SAM/SOM" data-tip-body="TAM: total possible revenue in the broad market. SAM: the portion you can serve with your model/geo/segment. SOM: realistic share you can capture in 12–24 months given resources and channels. Bigger isn’t always better—tight, reachable SOM matters.">
      <strong>Market Size Estimate</strong>
      <ul class="bullets two">
        <li><strong>TAM:</strong> ${response.audience_market.market_size.TAM}</li>
        <li><strong>SAM:</strong> ${response.audience_market.market_size.SAM}</li>
        <li><strong>SOM (12–24 mo):</strong> ${response.audience_market.market_size.SOM}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Growth Trends" data-tip-body="Tailwinds and headwinds shaping demand (e.g., remote work, AI adoption, regulation). Rising trends lower acquisition friction and support faster growth; negative shifts raise risk.">
      <strong>Growth Trends</strong>
      <div class="tags">
        ${response.audience_market.growth_trends.map(g => `<span class="tag">${g}</span>`).join('')}
      </div>
    </div>
  </div>
</section>

<!-- Second + third rows -->
<section class="panel g-competitors">
  <div class="panel-head">
    <h2 class="panel-title">Competitor Landscape</h2>
  </div>

  <!-- Competitor 1 -->
  <div class="comp-card"
       data-tip-title="${response.competitors.top5[0].type} Competitor"
       data-tip-body="${response.competitors.top5[0].notes}">
    <div class="comp-top">
      <div class="comp-name">${response.competitors.top5[0].name}</div>
      <a class="comp-link" href="${response.competitors.top5[0].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${response.competitors.top5[0].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${response.competitors.top5[0].market_share_pct_est}%</span></div>
    <span class="badge ${/High/i.test(response.competitors.top5[0].dominance) ? 'badge-amber' : ''}">Dominance: ${response.competitors.top5[0].dominance}</span>
  </div>

  <!-- Competitor 2 -->
  <div class="comp-card"
       data-tip-title="${response.competitors.top5[1].type} Competitor"
       data-tip-body="${response.competitors.top5[1].notes}">
    <div class="comp-top">
      <div class="comp-name">${response.competitors.top5[1].name}</div>
      <a class="comp-link" href="${response.competitors.top5[1].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${response.competitors.top5[1].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${response.competitors.top5[1].market_share_pct_est}%</span></div>
    <span class="badge">Dominance: ${response.competitors.top5[1].dominance}</span>
  </div>

  <!-- Competitor 3 -->
  <div class="comp-card"
       data-tip-title="${response.competitors.top5[2].type} Competitor"
       data-tip-body="${response.competitors.top5[2].notes}">
    <div class="comp-top">
      <div class="comp-name">${response.competitors.top5[2].name}</div>
      <a class="comp-link" href="${response.competitors.top5[2].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${response.competitors.top5[2].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${response.competitors.top5[2].market_share_pct_est}%</span></div>
    <span class="badge">Dominance: ${response.competitors.top5[2].dominance}</span>
  </div>
</section>

<section class="panel g-extra">
  <div class="panel-head">
    <h2 class="panel-title">Distribution & Acquisition</h2>
    <span class="panel-note">Channels • Benchmarks • Red Flags</span>
  </div>
  <div class="rows">
    <div class="row" data-tip-title="Primary Channels" data-tip-body="Acquisition paths you can win early (e.g., SEO, content, outbound, partnerships, PLG). Focus on 1–2 with the best intent and lowest CAC; layer others later.">
      <strong>Primary Channels</strong>
      <div class="tags">
        ${response.distribution_acquisition.primary_channels.map(ch => `<span class="tag">${ch}</span>`).join('')}
      </div>
    </div>

    <div class="row" data-tip-title="Benchmarks" data-tip-body="Directional metrics to judge traction and unit economics: CAC, LTV:CAC, payback period, free→paid conversion. Track these to validate a sustainable growth engine.">
      <strong>Benchmarks</strong>
      <ul class="bullets two">
        <li><strong>CAC:</strong> ${response.distribution_acquisition.benchmarks.CAC_self_serve_usd}</li>
        <li><strong>LTV:CAC:</strong> ${response.distribution_acquisition.benchmarks.LTV_to_CAC}</li>
        <li><strong>Payback:</strong> ${response.distribution_acquisition.benchmarks.payback_period}</li>
        <li><strong>Free→Paid:</strong> ${response.distribution_acquisition.benchmarks.free_to_paid_conv_pct}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Red Flags" data-tip-body="Risks that raise acquisition cost or block growth: platform dependence, policy changes, CPC spikes, incumbent moats, or legal/market restraints. Mitigate early.">
      <strong>Red Flags</strong>
      <ul class="bullets">
        ${response.distribution_acquisition.red_flags.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  </div>
</section>

<section class="panel verdict g-verdict"
         data-tip-title="Final Verdict"
         data-tip-body="A synthesized read on your ability to compete as pitched, weighing demand, moats, competitors, distribution, and economics. Use it to decide whether to narrow focus, add a wedge feature, or pivot.">
  <div class="verdict-left">
    <h2 class="panel-title">Competition Feasibility</h2>
    <p class="verdict-justification">${response.competition_feasibility.summary}</p>
    <p class="muted"><strong>Label:</strong> ${response.competition_feasibility.label}</p>
  </div>
  <div class="verdict-score">
    <div class="score-ring" style="--score:${response.competition_feasibility.score_0_100}">
      <div class="score-number">${response.competition_feasibility.score_0_100}</div>
    </div>
    <div class="score-label">Chance to Compete</div>
  </div>
</section>

      `
      return HTML
    }

    HTML = generateMarketHTML()

    document.querySelector('.js-grid').innerHTML = HTML;

    tooltip(response);


  } catch(error) {
    console.log(error)
  }
};


let idea = sessionStorage.getItem('idea');
idea = `Concept: Tracks your daily mood through quick emoji check-ins and uses AI to suggest activities or playlists to match or improve it.
Unique Twist: Visualizes your mood trends on a colorful, interactive world map that changes with your emotional “climate.”
marketBoard(idea)`
marketBoard(idea)


// Simple hover tooltip for any element with data-tip-title / data-tip-body
function tooltip(response) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  function showTip(e) {
    const t = e.currentTarget;
    const title = t.getAttribute('data-tip-title') || '';
    const body  = t.getAttribute('data-tip-body') || '';
    if (!title && !body) return;

    tooltip.innerHTML = `
      <div class="t-title">${title}</div>
      <div class="t-body">${body}</div>
    `;
    tooltip.style.display = 'block';
    moveTip(e);
  }

  function moveTip(e) {
    const offset = 14;
    tooltip.style.top  = `${e.clientY + offset}px`;
    tooltip.style.left = `${e.clientX + offset}px`;
  }

  function hideTip() {
    tooltip.style.display = 'none';
  }

  // Delegate over likely interactive blocks
  const hovers = document.querySelectorAll(
    '[data-tip-title],[data-tip-body], .comp-card, .row, .verdict'
  );
  hovers.forEach(el => {
    el.addEventListener('mouseenter', showTip);
    el.addEventListener('mousemove', moveTip);
    el.addEventListener('mouseleave', hideTip);
  });
};







/*
function tooltip(resultData) {
  const tooltip = document.getElementById('tooltip');
  document.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('mouseenter', e => {
      const label = tile.querySelector('.label').innerText;
      const score = tile.querySelector('.score').innerText;
      const desc  = tile.dataset.tooltip;
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <strong>${label}</strong>: <strong>${score}</strong>
        </div>
        <div class="tooltip-body">
          ${response[desc].justification}. 
        </div>
      `;
      tooltip.style.display = 'block';
    });
    tile.addEventListener('mousemove', e => {
      tooltip.style.top  = (e.clientY + 12) + 'px';
      tooltip.style.left = (e.clientX + 12) + 'px';
    });
    tile.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}
*/
