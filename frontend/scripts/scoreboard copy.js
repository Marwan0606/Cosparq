








// public/scripts/scoreboard.js
(async function () {
  async function scoreBoard() {
    try {
      // 1) Get user id
      const user = JSON.parse(localStorage.getItem('user'));
      const userId = user?.data?.user?._id;
      if (!userId) {
        console.error('No userId in localStorage.user'); 
        return;
      }

      // 2) Get the latest idea text for this user
      const ideaRes = await axios.get(`/api/save/idea/${userId}`);
      const ideaText = ideaRes?.data?.idea?.idea || '';
      if (!ideaText) {
        console.error('No idea found for user'); 
        return;
      }

      // 3) Try to load a previously saved scoreboard response from DB
      let resultData = null;
      try {
        const saved = await axios.get(`/api/save/saveScoreResponse/${userId}`);
        const raw = saved?.data?.scoreResponse?.scoreboardResponse;
        if (raw) {
          const jsonStr = typeof raw === 'string' ? raw : JSON.stringify(raw); // tolerate old bad records
          resultData = JSON.parse(jsonStr);
          console.log('Loaded scoreboard from DB');
        }
      } catch (_) {
        // ignore and fall through to AI
      }

      // 4) If none saved, call the **correct** AI endpoint and then persist
      if (!resultData) {
        console.log('Getting scoreboard from AI');
        const ai = await axios.post('/api/responses/idea', { idea: ideaText });
        const reply = ai?.data?.result; // model returns a JSON string
        if (!reply) {
          console.error('AI reply missing .data.result'); 
          return;
        }

        // Save raw JSON string to DB for future loads
        await axios.post('/api/save/saveScoreResponse', { scoreboardResponse: reply, userId });

        resultData = JSON.parse(reply);
      }

      // 5) Render UI
      const html = renderTiles(resultData);
      const mount = document.querySelector('.js-scoreboard');
      if (mount) mount.innerHTML = html;

      attachTooltips(resultData);
    } catch (err) {
      console.error(err);
    }
  }

  function renderTiles(d) {
    const safe = (v, f = '—') => (v ?? f);
    return `
      <div class="tile barrier" data-tooltip="Barrier to Entry">
        <div class="label">Barrier to Entry</div>
        <div class="score">${safe(d["Barrier to Entry"]?.score)}</div>
      </div>
      <div class="tile orig" data-tooltip="Originality">
        <div class="label">Originality</div>
        <div class="score">${safe(d["Originality"]?.score)}</div>
      </div>
      <div class="tile scal" data-tooltip="Scalability">
        <div class="label">Scalability</div>
        <div class="score">${safe(d["Scalability"]?.score)}</div>
      </div>
      <div class="tile overall" data-tooltip="Overall">
        <div class="label">Overall</div>
        <div class="score">${safe(d["Overall"]?.score)}</div>
      </div>
      <div class="tile monet" data-tooltip="Monetization Potential">
        <div class="label">Monetization Potential</div>
        <div class="score">${safe(d["Monetization Potential"]?.score)}</div>
      </div>
      <div class="tile mark" data-tooltip="Market Demand">
        <div class="label">Market Demand</div>
        <div class="score">${safe(d["Market Demand"]?.score)}</div>
      </div>
      <div class="tile tech" data-tooltip="Technical Feasibility">
        <div class="label">Technical Feasibility</div>
        <div class="score">${safe(d["Technical Feasibility"]?.score)}</div>
      </div>
      <div class="tile legal" data-tooltip="Regulatory & Legal Complexity">
        <div class="label">Regulatory & Legal</div>
        <div class="score">${safe(d["Regulatory & Legal Complexity"]?.score)}</div>
      </div>
    `;
  }

  function attachTooltips(d) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    document.querySelectorAll('.tile').forEach(tile => {
      tile.addEventListener('mouseenter', e => {
        const label = tile.querySelector('.label')?.innerText || '';
        const score = tile.querySelector('.score')?.innerText || '';
        const key   = tile.dataset.tooltip;
        const just  = d?.[key]?.justification || 'No justification provided.';

        tooltip.innerHTML = `
          <div class="tooltip-header"><strong>${label}</strong>: <strong>${score}</strong></div>
          <div class="tooltip-body">${just}</div>
        `;
        tooltip.style.display = 'block';
      });
      tile.addEventListener('mousemove', e => {
        tooltip.style.top  = `${e.clientY + 12}px`;
        tooltip.style.left = `${e.clientX + 12}px`;
      });
      tile.addEventListener('mouseleave', () => (tooltip.style.display = 'none'));
    });
  }

  // kick off
  scoreBoard();
})();
