axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies

const marketBoard = async ()=>{
  try {
    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    console.log(`IdeaId is: ${ideaId}`)


    let idea = await axios.get(`/api/save/idea/${ideaId}`)
    const ideaText = idea?.data?.idea?.idea;
    if (!ideaText) {
      document.querySelector('.js-grid').innerHTML = `
        <div class="empty-message-container">
          <div class="empty-message">
            It seems like you have no ideas started, input your first idea so you can see this page
          </div>
        </div>
      `
      return;
    }
    idea = idea.data.idea.idea
    console.log(idea)


    let response;
    let resultData;
    try {
      response = await axios.get(`/api/save/saveMarket/${ideaId}`);

      if (response.data && response.data.marketResponse) {
        console.log('getting from database');
        let marketResponse = response.data.marketResponse.marketResearchResponse
        while (!marketResponse) {
          response = await axios.get(`/api/save/saveMarket/${ideaId}`)
          console.log(response)
          marketResponse = response.data.marketResponse.marketResearchResponse

          if (!marketResponse) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        resultData = JSON.parse(marketResponse);
      } else {
        console.log('getting from AI');
        response = await axios.post('/api/responses/research', { idea, ideaId });
        console.log(response)
        console.log(response.data.result);
        let marketResearchResponse = response.data.result;
        
        //let saveMarketResponse = await axios.post('/api/save/saveMarket', {marketResearchResponse, ideaId})
        //console.log(saveMarketResponse)

        resultData = JSON.parse(response.data.result);
        
      }
      console.log('result data', resultData)
    } catch (error) {
      console.log('Error fetching from database');
      console.log(error)
      /*
      response = await axios.post('/api/responses/research', { idea });
      let saveMarketResponse = await axios.post('/api/save/saveMarket', {marketResearchResponse, userId})
      console.log(saveMarketResponse)
      resultData = JSON.parse(response.data.result);
      */
    }

    /*
    if (localStorage.getItem('response-research')) { //I THINK THERES A BUG THATS GONNA HAPPEN HERE BECAUSE WE NEVER CLEAR LOCAL STORAGE
      response = JSON.parse(localStorage.getItem('response-research'))
    } else {
      response = await axios.post('/api/research', {
        idea: idea
      });
    }
    */

    //console.log(response);
    
    //localStorage.setItem('response-research', JSON.stringify(response));

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
        ${resultData.monetization_pricing.models.map(m => `<span class="tag">${m}</span>`).join('')}
      </div>
    </div>

    <div class="row" data-tip-title="Price Benchmarks" data-tip-body="What competitors charge today. Use as an anchor for initial tests—not a rule. Helps position your value, set price experiments, and estimate early revenue.">
      <strong>Pricing Benchmarks</strong>
      <ul class="bullets">
        <li><strong>Individuals:</strong> ${resultData.monetization_pricing.pricing_benchmarks.individuals}</li>
        <li><strong>Teams:</strong> ${resultData.monetization_pricing.pricing_benchmarks.teams}</li>
        <li><strong>Add-ons:</strong> ${resultData.monetization_pricing.pricing_benchmarks.add_ons}</li>
        <li><strong>One-offs:</strong> ${resultData.monetization_pricing.pricing_benchmarks.one_offs}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Willingness to Pay" data-tip-body="Estimated amount target users will pay given perceived value and ROI (time saved, revenue unlocked, risk reduced). Validate via surveys, interviews, and live pricing tests.">
      <strong>Willingness to Pay (WTP)</strong>
      <p class="muted">${resultData.monetization_pricing.willingness_to_pay}</p>
    </div>

    <div class="row" data-tip-title="Gross Margins" data-tip-body="Revenue minus direct variable costs. Higher gross margin (e.g., 70–90%) leaves room for CAC, support, and profit—key for scalable software businesses. Watch paid APIs and other variable costs.">
      <strong>Expected Margins</strong>
      <div class="tags">
        <span class="tag tag-okay">${resultData.monetization_pricing.expected_margins.gross_margin_pct_range} GM</span>
        <span class="tag">CAC payback: ${resultData.monetization_pricing.expected_margins.cac_payback}</span>
        <span class="tag">Churn: ${resultData.monetization_pricing.expected_margins.churn_sensitivity}</span>
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
        ${resultData.audience_market.target_demographics.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>

    <div class="row" data-tip-title="TAM/SAM/SOM" data-tip-body="TAM: total possible revenue in the broad market. SAM: the portion you can serve with your model/geo/segment. SOM: realistic share you can capture in 12–24 months given resources and channels. Bigger isn’t always better—tight, reachable SOM matters.">
      <strong>Market Size Estimate</strong>
      <ul class="bullets two">
        <li><strong>TAM:</strong> ${resultData.audience_market.market_size.TAM}</li>
        <li><strong>SAM:</strong> ${resultData.audience_market.market_size.SAM}</li>
        <li><strong>SOM (12–24 mo):</strong> ${resultData.audience_market.market_size.SOM}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Growth Trends" data-tip-body="Tailwinds and headwinds shaping demand (e.g., remote work, AI adoption, regulation). Rising trends lower acquisition friction and support faster growth; negative shifts raise risk.">
      <strong>Growth Trends</strong>
      <div class="tags">
        ${resultData.audience_market.growth_trends.map(g => `<span class="tag">${g}</span>`).join('')}
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
       data-tip-title="${resultData.competitors.top5[0].type} Competitor"
       data-tip-body="${resultData.competitors.top5[0].notes}">
    <div class="comp-top">
      <div class="comp-name">${resultData.competitors.top5[0].name}</div>
      <a class="comp-link" href="${resultData.competitors.top5[0].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${resultData.competitors.top5[0].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${resultData.competitors.top5[0].market_share_pct_est}%</span></div>
    <span class="badge ${/High/i.test(resultData.competitors.top5[0].dominance) ? 'badge-amber' : ''}">Dominance: ${resultData.competitors.top5[0].dominance}</span>
  </div>

  <!-- Competitor 2 -->
  <div class="comp-card"
       data-tip-title="${resultData.competitors.top5[1].type} Competitor"
       data-tip-body="${resultData.competitors.top5[1].notes}">
    <div class="comp-top">
      <div class="comp-name">${resultData.competitors.top5[1].name}</div>
      <a class="comp-link" href="${resultData.competitors.top5[1].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${resultData.competitors.top5[1].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${resultData.competitors.top5[1].market_share_pct_est}%</span></div>
    <span class="badge">Dominance: ${resultData.competitors.top5[1].dominance}</span>
  </div>

  <!-- Competitor 3 -->
  <div class="comp-card"
       data-tip-title="${resultData.competitors.top5[2].type} Competitor"
       data-tip-body="${resultData.competitors.top5[2].notes}">
    <div class="comp-top">
      <div class="comp-name">${resultData.competitors.top5[2].name}</div>
      <a class="comp-link" href="${resultData.competitors.top5[2].url}" target="_blank" rel="noopener">Visit ↗</a>
    </div>
    <div class="metric"><span>Directness</span><span>${resultData.competitors.top5[2].directness_pct}%</span></div>
    <div class="metric"><span>Market Share</span><span>${resultData.competitors.top5[2].market_share_pct_est}%</span></div>
    <span class="badge">Dominance: ${resultData.competitors.top5[2].dominance}</span>
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
        ${resultData.distribution_acquisition.primary_channels.map(ch => `<span class="tag">${ch}</span>`).join('')}
      </div>
    </div>

    <div class="row" data-tip-title="Benchmarks" data-tip-body="Directional metrics to judge traction and unit economics: CAC, LTV:CAC, payback period, free→paid conversion. Track these to validate a sustainable growth engine.">
      <strong>Benchmarks</strong>
      <ul class="bullets two">
        <li><strong>CAC:</strong> ${resultData.distribution_acquisition.benchmarks.CAC_self_serve_usd}</li>
        <li><strong>LTV:CAC:</strong> ${resultData.distribution_acquisition.benchmarks.LTV_to_CAC}</li>
        <li><strong>Payback:</strong> ${resultData.distribution_acquisition.benchmarks.payback_period}</li>
        <li><strong>Free→Paid:</strong> ${resultData.distribution_acquisition.benchmarks.free_to_paid_conv_pct}</li>
      </ul>
    </div>

    <div class="row" data-tip-title="Red Flags" data-tip-body="Risks that raise acquisition cost or block growth: platform dependence, policy changes, CPC spikes, incumbent moats, or legal/market restraints. Mitigate early.">
      <strong>Red Flags</strong>
      <ul class="bullets">
        ${resultData.distribution_acquisition.red_flags.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  </div>
</section>

<section class="panel verdict g-verdict"
         data-tip-title="Final Verdict"
         data-tip-body="A synthesized read on your ability to compete as pitched, weighing demand, moats, competitors, distribution, and economics. Use it to decide whether to narrow focus, add a wedge feature, or pivot.">
  <div class="verdict-left">
    <h2 class="panel-title">Competition Feasibility</h2>
    <p class="verdict-justification">${resultData.competition_feasibility.summary}</p>
    <p class="muted"><strong>Label:</strong> ${resultData.competition_feasibility.label}</p>
  </div>
  <div class="verdict-score">
    <div class="score-ring" style="--score:${resultData.competition_feasibility.score_0_100}">
      <div class="score-number">${resultData.competition_feasibility.score_0_100}</div>
    </div>
    <div class="score-label">Chance to Compete</div>
  </div>
</section>

      `
      return HTML
    }

    HTML = generateMarketHTML()

    document.querySelector('.js-grid').innerHTML = HTML;

    tooltip(resultData);


  } catch(error) {
    console.log(error)
  }
};


//let idea = sessionStorage.getItem('idea');
marketBoard()


// Simple hover tooltip for any element with data-tip-title / data-tip-body
function tooltip(resultData) {
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
