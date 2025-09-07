axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies



const scoreBoard = async (idea)=>{
  try {
    
    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    console.log(`IdeaId is: ${ideaId}`)
    
    let ideaExists = true
    let idea;
    try {
      idea = await axios.get(`/api/save/idea/${ideaId}`)
    } catch (error) {
      console.log('idea doesnt exist')
      ideaExists = false
    }
    
    const ideaDoc = idea?.data?.idea || null;
    const ideaText = (ideaDoc?.idea || '').trim();
    //console.log(idea)
    //const ideaText = idea?.data?.idea?.idea;
    //console.log(ideaText)

    if (!ideaExists || !ideaText) {
      document.querySelector('.js-scoreboard').innerHTML = `
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
    //let idea = "An AI powered app that helps you manage your day and schedule"



    let response;
    let resultData;
    try {
      response = await axios.get(`/api/save/saveScoreResponse/${ideaId}`);
      if (response.data && response.data.scoreResponse) {
        console.log('getting from database');
        let scoreboardResponse = response.data.scoreResponse.scoreboardResponse
        while (!scoreboardResponse) {
          response = await axios.get(`/api/save/saveScoreResponse/${ideaId}`);
          console.log(response)
          scoreboardResponse = response.data.scoreResponse.scoreboardResponse

          if (!scoreboardResponse) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        resultData = JSON.parse(scoreboardResponse);
        console.log('DB resultData', resultData)
      } else {
        console.log('getting from AI');
        response = await axios.post('/api/responses/idea', { idea , ideaId});
        console.log(response.data.result);
        let scoreboardResponse = response.data.result;
        
        //let saveScoreResponse = await axios.post('/api/save/saveScoreResponse', {scoreboardResponse, ideaId})
        //console.log(saveScoreResponse)

        resultData = JSON.parse(response.data.result);
        console.log('AI resultData', resultData)
      }
    } catch (error) {
      console.log('Error fetching from database, getting from AI');
      console.log(error)
      /*
      response = await axios.post('/api/responses/idea', { idea });
      let saveScoreResponse = await axios.post('/api/save/saveScoreResponse', {scoreboardResponse, ideaId})
      console.log(saveScoreResponse)
      resultData = JSON.parse(response.data.result);
      */
    }


    //console.log(response.data.result);

    //let scoreboardResponse = response.data.result;
    
    //newScoreGenerate = false
    //localStorage.setItem('newScoreGenerateValue', newScoreGenerate)

    //let saveScoreResponse = await axios.post('/api/save/saveScoreResponse', {scoreboardResponse, userId})
    //console.log(saveScoreResponse)

    //localStorage.setItem('response', JSON.stringify(response));
   

    //let resultData = JSON.parse(response.data.result);

    //const resultData = JSON.parse(response.result);

    let HTML = ``

    function generateScoreHTML() {
      HTML += `
      <div class="tile barrier" data-tooltip="Barrier to Entry">
        <div class="label">Barrier to Entry</div>
        <div class="score">${resultData["Barrier to Entry"].score}</div>
      </div>
      <div class="tile orig" data-tooltip="Originality">
        <div class="label">Originality</div>
        <div class="score">${resultData["Originality"].score}</div>
      </div>
      <div class="tile scal" data-tooltip="Scalability">
        <div class="label">Scalability</div>
        <div class="score">${resultData["Scalability"].score}</div>
      </div>
      <div class="tile overall" data-tooltip="Overall">
        <div class="label">Overall</div>
        <div class="score">${resultData["Overall"].score}</div>
      </div>
      <div class="tile monet" data-tooltip="Monetization Potential">
        <div class="label">Monetization Potential</div>
        <div class="score">${resultData["Monetization Potential"].score}</div>
      </div>
      <div class="tile mark" data-tooltip="Market Demand">
        <div class="label">Market Demand</div>
        <div class="score">${resultData["Market Demand"].score}</div>
      </div>
      <div class="tile tech" data-tooltip="Technical Feasibility">
        <div class="label">Technical Feasibility</div>
        <div class="score">${resultData["Technical Feasibility"].score}</div>
      </div>
      <div class="tile legal" data-tooltip="Regulatory & Legal Complexity">
        <div class="label">Regulatory & Legal</div>
        <div class="score">${resultData["Regulatory & Legal Complexity"].score}</div>
      </div>
      `
      return HTML
    }

    HTML = generateScoreHTML()

    document.querySelector('.js-scoreboard').innerHTML = HTML;
    console.log(resultData)
    tooltip(resultData);


  } catch(error) {
    
    console.log(error)
  }
};


const idea = sessionStorage.getItem('idea');

scoreBoard(idea)



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
          ${resultData[desc].justification}. 
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








//THIS IS FOR THE CODE FOR REGENERATING SCOREBOARD

document.querySelector('.js-regenerate-response-btn').addEventListener('click', async ()=>{
  
  let ideaId = JSON.parse(localStorage.getItem('ideaId'))

  console.log(ideaId)
  const wrap = document.querySelector('.js-scoreboard');
  wrap.innerHTML = `
        <div class="frame">
        <div class="brand-wrap">
          <div class="brand">Your AI is Making Your Scoreboard</div>
          <!--<div class="new dotting"></div>-->
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

            <!-- Links -->
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

            <!-- Nodes -->
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

        <!-- Bottom-right status -->
        <div class="status dotting">Loading</div>
  `
  const { startLoadingAnimation } = await import('../scripts/loading.js');
  startLoadingAnimation(wrap);
  let chatLogs = await getChatLogs(ideaId)
  let newIdea = await renewIdea(ideaId, chatLogs)
  newIdea = await popup(newIdea)
  await updateIdea(ideaId, newIdea)
  await deleteScoreboard(ideaId)
  //window.location.reload();

  let idea = sessionStorage.getItem('idea');
  scoreBoard(idea)
})

const getChatLogs = async (ideaId)=>{
  try {
    let resp = await axios.get(`/api/save/getAllChats/${ideaId}`);
    const chatLogs  = Array.isArray(resp.data?.savedChat) ? resp.data.savedChat : [];
    console.log(chatLogs)
    let listOfChats = ''
    chatLogs.forEach((chatLog)=>{
      listOfChats += chatLog.userMessage
      listOfChats += chatLog.AiResponse
    })
    //console.log(listOfChats)
    return listOfChats
  } catch (error) {
    console.log(error)
  }
}


const renewIdea = async(ideaId, chatLogs)=>{
  try {
    let getFromDB = await axios.get(`/api/save/saveRenewResponse/${ideaId}`)
    if (getFromDB.data.renewResponse) {
      console.log('getting from database');
      console.log(getFromDB)
      let newIdea = getFromDB.data.renewResponse.renewIdeaResponse
      //newIdea = newIdea.idea
      console.log('newIdea', newIdea)
      while (!newIdea && !newIdea) {
        let response = await axios.get(`/api/save/saveRenewResponse/${ideaId}`);
        console.log('in while loop', response)
        newIdea = response.data.renewResponse.renewIdeaResponse
        console.log(newIdea)

        if (!newIdea) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      newIdea = JSON.parse(newIdea)
      newIdea = newIdea.idea
      console.log(newIdea)
      return newIdea
    } else {
      console.log('getting from AI');
      let oldIdea = await axios.get(`/api/save/idea/${ideaId}`)
      console.log(oldIdea)
      let {data} = await axios.post('/api/responses/renewIdea', { oldIdea, chatLogs, ideaId });
      console.log(data)
      let newIdea = JSON.parse(data.result)
      newIdea = newIdea.idea
      console.log(newIdea)
      return newIdea
    }
  } catch (error) {
    console.log(error)
  }
}


const updateIdea = async(ideaId, newIdea)=>{
  try {
    await axios.patch(`/api/save/idea/${ideaId}`, {idea: newIdea})
    await axios.delete(`/api/save/saveRenewResponse/${ideaId}`)
    return
  } catch (error) {
    console.log(error)
  }
}

const deleteScoreboard = async (ideaId)=>{
  try {
    const response = await axios.delete(`/api/save/saveScoreResponse/${ideaId}`)
    console.log(`DELETE SCORE RESPONSE ${response}`)
    return
  } catch (error) {
    console.log(error)
  }
}


function popup(newIdea) {
  return new Promise((resolve) => {
    const popupOverlay = document.getElementById('popupOverlay');
    const confirmBtn = document.getElementById('confirmBtn');
    const popupInput = document.getElementById('popupInput');

    popupOverlay.classList.add('active');
    popupInput.value = newIdea;

    confirmBtn.onclick = () => {
      popupOverlay.classList.remove('active')
      resolve(popupInput.value); // return the final input value
    };
  });
}

/*
document.getElementById('showPopup').addEventListener('click', ()=>{
  popup('test')
})
*/

/*
document.querySelector('.confirm-button').addEventListener('click', ()=>{
  popupOverlay.style.display = 'none';
})
*/