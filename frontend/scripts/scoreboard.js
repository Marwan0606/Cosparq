// set-axios-defaults.js
const token = localStorage.getItem('accessToken');
if (!token) {
  window.location.href = 'auth.html';
} else {
  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}



const scoreBoard = async (idea)=>{
  try {
    /*
    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id
    console.log(userId)
    */
  
    
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
        resultData = JSON.parse(scoreboardResponse);
      } else {
        console.log('getting from AI');
        response = await axios.post('/api/responses/idea', { idea });
        console.log(response.data.result);
        let scoreboardResponse = response.data.result;
        
        let saveScoreResponse = await axios.post('/api/save/saveScoreResponse', {scoreboardResponse, ideaId})
        console.log(saveScoreResponse)

        resultData = JSON.parse(response.data.result);
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
    let oldIdea = await axios.get(`/api/save/idea/${ideaId}`)
    console.log(oldIdea)
    let {data} = await axios.post('/api/responses/renewIdea', { oldIdea, chatLogs });
    console.log(data)
    let newIdea = JSON.parse(data.result)
    newIdea = newIdea.idea
    console.log(newIdea)
    
    return newIdea
  } catch (error) {
    console.log(error)
  }
}


const updateIdea = async(ideaId, newIdea)=>{
  try {
    await axios.patch(`/api/save/idea/${ideaId}`, {idea: newIdea})
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