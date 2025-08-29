axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies


const actionBoard = async ()=>{
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
      response = await axios.get(`/api/save/saveAction/${ideaId}`);
      console.log(response)
      
      
      if (response.data && response.data.actionResponse) {
        console.log('getting from database');
        let actionResponse = response.data.actionResponse.actionPlanResponse
        resultData = JSON.parse(actionResponse);
        console.log(resultData)
      } else {
        console.log('getting from AI');
        response = await axios.post('/api/responses/actionPlan', { idea });
        console.log(response.data.result);
        let actionPlanResponse = response.data.result;
        
        let saveActionResponse = await axios.post('/api/save/saveAction', {actionPlanResponse, ideaId})
        console.log(saveActionResponse)

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