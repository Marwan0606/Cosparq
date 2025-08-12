let chatResponse = async ()=>{
  try {
    console.log('start')

    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id
    console.log(userId)

    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    console.log(ideaId)


    let scoreboard = await axios.get(`/api/save/saveScoreResponse/${userId}/${ideaId}`);
    scoreboard = scoreboard.data.scoreResponse.scoreboardResponse

    let idea = await axios.get(`/api/save/idea/${userId}/${ideaId}`)
    idea = idea.data.idea.idea


    console.log(scoreboard) //FIGURE OUT WAY TO REMOVE JUSTIFICATION
    console.log(idea)

    userInput = document.querySelector('.chat-input').value

    let lastUserResponse='';
    let lastAiResponse='';




    let response = await axios.post('/api/responses/chat', {scoreboard, idea, lastUserResponse, lastAiResponse, userInput})
    response = response.data.result

    console.log(response)

    let HTML = '';
    function generateChatBubbles() {
      HTML += `
      <div class="message user">
        <div class="bubble">
          ${userInput}
          <div class="timestamp">02:27 PM</div>
        </div>
      </div>
      <div class="message bot">
        <div class="avatar">🤖</div>
        <div class="bubble">
          ${response}
          <div class="timestamp">02:26 PM</div>
        </div>
      </div>
      `
      return HTML
    }
    HTML = generateChatBubbles()
    document.querySelector('.js-chat-window').innerHTML = HTML

    response = lastAiResponse
    userInput = lastUserResponse

  } catch (error) {
    console.log(error)
  }
}



document.querySelector('.js-send').addEventListener('click', ()=>{
  chatResponse()
})