//const ScoreboardResponses = require("../../backend/models/Scoreboard-responses");

const scoreBoard = async (idea)=>{
  try {

    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id
    console.log(userId)
    
    /*
    let newScoreGenerate = localStorage.getItem('newScoreGenerateValue') //PROBLEM THIS TURNS NEWSCOREGENERATE TO TRUE AGAIN
    console.log(newScoreGenerate)
    */

    
    //idea = await axios.get(`/api/save/idea/${userId}`)
    let idea = "An AI powered app that helps you manage your day and schedule"


    let response = ''
    if (!newScoreGenerate) {
      console.log('getting from database')
      response = await axios.get(`/api/save/saveScoreResponse/${userId}`)
    } else {
      console.log('getting from AI')
      response = await axios.post('/api/responses/idea', {
        idea: idea
      });
    }
    console.log(response.data.result);

    let scoreboardResponse = response.data.result;
    
    newScoreGenerate = false
    localStorage.setItem('newScoreGenerateValue', newScoreGenerate)

    let saveScoreResponse = await axios.post('/api/save/saveScoreResponse', {scoreboardResponse, userId})
    console.log(saveScoreResponse)
    //localStorage.setItem('response', JSON.stringify(response));

    /*
    let response = {
    "result": "{\n  \"Originality\": {\n    \"score\": 60,\n    \"justification\": \"While collaborative to-do apps are common, your focus on real-time sharing, urgency labels, and task ownership adds value. However, these features are not entirely unique, as many existing apps offer similar functionalities.\"\n  },\n  \"Market Demand\": {\n    \"score\": 85,\n    \"justification\": \"The demand for efficient team collaboration tools is high, especially with remote work trends. Teams require effective task management solutions to enhance productivity and accountability.\"\n  },\n  \"Technical Feasibility\": {\n    \"score\": 80,\n    \"justification\": \"Developing a live, collaborative to-do app with features like real-time updates, user assignments, and urgency labels is technically feasible. Existing frameworks and technologies can support such development.\"\n  },\n  \"Barrier to Entry\": {\n    \"score\": 70,\n    \"justification\": \"The market has established players like Trello and Asana. Competing requires differentiation and significant marketing efforts to attract users from these incumbents.\"\n  },\n  \"Monetization Potential\": {\n    \"score\": 75,\n    \"justification\": \"Freemium models with premium features, subscriptions, or enterprise solutions can generate revenue. However, convincing users to pay amidst free alternatives poses a challenge.\"\n  },\n  \"Scalability\": {\n    \"score\": 85,\n    \"justification\": \"The app can scale by adding more users and teams without substantial additional costs, leveraging cloud infrastructure and modular design.\"\n  },\n  \"Regulatory & Legal Complexity\": {\n    \"score\": 60,\n    \"justification\": \"Handling user data requires compliance with data protection regulations like GDPR. Implementing robust security measures is essential to mitigate legal risks.\"\n  },\n  \"Overall\": {\n    \"score\": 70,\n    \"justification\": \"The app addresses a clear need in the market with feasible development plans. However, differentiating from established competitors and ensuring user adoption are critical challenges to its success.\"\n  }\n} "
    }
    */
   

    const resultData = JSON.parse(response.data.result);

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
