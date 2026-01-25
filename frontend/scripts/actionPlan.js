axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies


const actionBoard = async ()=>{
  try {
    // Show loading animation
    const grid = document.querySelector('.js-grid');
    grid.innerHTML = `
        <div class="frame">
        <div class="brand-wrap">
          <div class="brand">Your AI is Creating Your Action Plan</div>
        </div>

        <div class="viz">
          <svg viewBox="0 0 800 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stop-color="#8400ff"/>
                <stop offset="40%" stop-color="#f94016"/>
                <stop offset="60%" stop-color="#f96d16"/>
                <stop offset="100%" stop-color="#3b82f6"/>
              </linearGradient>
            </defs>

            <g id="links">
              <line class="link" data-a="n1"  data-b="n5" x1="130" y1="90"  x2="320" y2="130"/>
              <line class="link" data-a="n5"  data-b="n6" x1="320" y1="130" x2="410" y2="90"/>
              <line class="link" data-a="n6"  data-b="c"  x1="410" y1="90"  x2="400" y2="260"/>
              <line class="link" data-a="n2"  data-b="n5" x1="120" y1="250" x2="320" y2="130"/>
              <line class="link" data-a="n2"  data-b="c"  x1="120" y1="250" x2="400" y2="260"/>
              <line class="link" data-a="n3"  data-b="c"  x1="160" y1="400" x2="400" y2="260"/>
              <line class="link" data-a="n4"  data-b="c"  x1="300" y1="460" x2="400" y2="260"/>
              <line class="link" data-a="n7"  data-b="c"  x1="650" y1="110" x2="400" y2="260"/>
              <line class="link" data-a="n7"  data-b="n8" x1="650" y1="110" x2="720" y2="240"/>
              <line class="link" data-a="n8"  data-b="n9" x1="720" y1="240" x2="620" y2="370"/>
              <line class="link" data-a="n9"  data-b="c"  x1="620" y1="370" x2="400" y2="260"/>
              <line class="link" data-a="n10" data-b="c"  x1="470" y1="470" x2="400" y2="260"/>
            </g>

            <g id="nodes">
              <circle id="n1"  class="node" cx="130" cy="90"  r="7"/>
              <circle id="n2"  class="node" cx="120" cy="250" r="7"/>
              <circle id="n3"  class="node" cx="160" cy="400" r="7"/>
              <circle id="n4"  class="node" cx="300" cy="460" r="7"/>
              <circle id="n5"  class="node" cx="320" cy="130" r="7"/>
              <circle id="n6"  class="node" cx="410" cy="90"  r="7"/>
              <circle id="n7"  class="node" cx="650" cy="110" r="7"/>
              <circle id="n8"  class="node" cx="720" cy="240" r="7"/>
              <circle id="n9"  class="node" cx="620" cy="370" r="7"/>
              <circle id="n10" class="node" cx="470" cy="470" r="7"/>
              <circle id="c"   class="node center" cx="400" cy="260" r="9"/>
            </g>
          </svg>
        </div>

        <div class="status dotting">Loading</div>
    `;
    const { startLoadingAnimation } = await import('../scripts/loading.js');
    startLoadingAnimation(grid);

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
      response = await axios.get(`/api/save/saveAction/${ideaId}`);
      console.log(response)
      
      
      if (response.data && response.data.actionResponse) {
        console.log('getting from database');
        let actionResponse = response.data.actionResponse.actionPlanResponse
        while (!actionResponse) {
          response = await axios.get(`/api/save/saveAction/${ideaId}`);
          actionResponse = response.data.actionResponse.actionPlanResponse
          console.log(actionResponse)

          if (!actionResponse) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        resultData = JSON.parse(actionResponse);
        console.log(resultData)
      } else {
        console.log('getting from AI');
        //let saveInitialResponse = await axios.post('api/save/saveActon', {ideaId})
        //console.log('inital response status save', saveInitialResponse)
        response = await axios.post('/api/responses/actionPlan', { idea, ideaId });
        /*
        if (!response) {
          const deleteRes = await axios.delete(`/api/save/saveAction/${ideaId}`)
          console.log('failed, response deleted', deleteRes)
        }
        */
        console.log(response.data.result);
        let actionPlanResponse = response.data.result;
        //let saveActionResponse = await axios.put(`/api/save/saveAction/${ideaId}`, {actionPlanResponse, status:'success'})
        //console.log(saveActionResponse)

        resultData = JSON.parse(response.data.result);
        console.log(resultData)
        
      }
      
    } catch (error) {
      console.log('Error fetching from database');
      console.log(error)
    }

    let HTML = ``

    function generateMarketHTML() {
      HTML += `
<div class="concept-card">
    <div class="concept-header">
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
      <h3>Your Startup Concept</h3>
    </div>
    <div class="concept-content">${resultData.concept.summary}</div>
  </div>

  <!-- MVP & Tech Stack Grid -->
  <div class="plan-grid">
    <div class="card mvp-features">
      <div class="card-header">
        <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        <h3>MVP Features</h3>
      </div>
      <ul>
        ${resultData.mvp.features.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>

    <div class="card tech-stack">
      <div class="card-header">
        <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3v2h8V3H8zm-3 4v2h14V7H5zm-2 4v2h18v-2H3zm0 4v2h18v-2H3zm2 4v2h14v-2H5z"/></svg>
        <h3>Recommended Tech Stack</h3>
      </div>
      <div class="tags-group">
        <div class="tag-group"><strong>Frontend:</strong>
          ${resultData.tech_stack.frontend.map(f => `<span>${f}</span>`).join('')}
        </div>
        <div class="tag-group"><strong>Backend:</strong>
          ${resultData.tech_stack.backend.map(b => `<span>${b}</span>`).join('')}
        </div>
        <div class="tag-group"><strong>Infrastructure:</strong>
          ${resultData.tech_stack.infrastructure.map(i => `<span>${i}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Timeline -->
  <div class="timeline-card">
    <div class="card-header">
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3zm2 4h14v12H5z"/></svg>
      <h3>${resultData.timeline.label}</h3>
    </div>
    <ol class="timeline-list">
      ${resultData.timeline.steps.map(step => `
        <li class="tile" data-tooltip="${Number(step.step)-1}">
          <div class="step-number">${step.step}</div>
          <div class="step-info">
            <div class="step-title">${step.title}</div>
            <div class="step-subtitle">${step.timeframe}</div>
          </div>
          <div class="badge ${step.priority.toLowerCase()}">${step.priority}</div>
        </li>
      `).join('')}
    </ol>
  </div>

  <!-- CTA Buttons -->
  <div class="cta-buttons">
    <button class="cta primary">Start Building with AI</button>
    <button class="cta secondary">Share Plan</button>
  </div>
`;
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
actionBoard()



function tooltip(resultData) {
  const tooltip = document.querySelector('.tooltip')
  document.querySelectorAll('.tile').forEach((tile)=>{
    tile.addEventListener('mouseenter', e => {
    const desc  = tile.dataset.tooltip;
    tooltip.innerHTML = `
      <div class="t-body">${resultData.timeline.steps[desc].details}</div>
    `
    tooltip.style.display = 'block';
    })

    tile.addEventListener('mousemove', e => {
      tooltip.style.top  = (e.clientY + 12) + 'px';
      tooltip.style.left = (e.clientX + 12) + 'px';
    });
    tile.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  })
}