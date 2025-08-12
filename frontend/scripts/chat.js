let chatResponse = async ()=>{
  try {

    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id

    let ideaId = JSON.parse(localStorage.getItem('ideaId'))


    let scoreboard = await axios.get(`/api/save/saveScoreResponse/${userId}/${ideaId}`);
    scoreboard = scoreboard.data.scoreResponse.scoreboardResponse

    let idea = await axios.get(`/api/save/idea/${userId}/${ideaId}`)
    idea = idea.data.idea.idea


    //console.log(scoreboard) //FIGURE OUT WAY TO REMOVE JUSTIFICATION
    //console.log(idea)

    userInput = document.querySelector('.chat-input').value


    //get previous responses
    let historyResponses = await axios.get(`api/save/getChat/${userId}/${ideaId}`)

    let lastUserResponse = '';
    let lastAiResponse   = '';

    const saved = historyResponses.data?.savedChat || null;
    if (saved) {
      lastUserResponse = historyResponses.data.savedChat.userMessage
      lastAiResponse = historyResponses.data.savedChat.AiResponse
    }
    console.log(lastUserResponse)
    console.log(lastAiResponse)





    let response = await axios.post('/api/responses/chat', {scoreboard, idea, lastUserResponse, lastAiResponse, userInput})
    console.log(response)
    response = JSON.parse(response.data.result)
    let reply = response.reply
    let userMessage = response.user_summary
    let AiResponse = response.assistant_summary


    
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
          ${reply}
          <div class="timestamp">02:26 PM</div>
        </div>
      </div>
      `
      return HTML
    }
    HTML = generateChatBubbles()
    document.querySelector('.js-chat-window').innerHTML = HTML
    

    //saving responses

    await axios.post('api/save/chat', {userMessage, AiResponse, ideaId, userId})

    await axios.post('api/save/chatRaw', {userMessage: userInput, AiResponse: reply, ideaId, userId})


  } catch (error) {
    console.log(error)
  }
}



document.querySelector('.js-send').addEventListener('click', ()=>{
  chatResponse()
})


// Load all saved chat history when page loads
async function loadChatHistory() {
  try {
    let user = JSON.parse(localStorage.getItem('user'));
    let userId = user.data.user._id;
    let ideaId = JSON.parse(localStorage.getItem('ideaId'));

    let history = await axios.get(`/api/save/getAllChatsRaw/${userId}/${ideaId}`);
    let chats = history.data.savedChat || [];

    let HTML = '';
    chats.forEach(chat => {
      HTML += `
        <div class="message user">
          <div class="bubble">
            ${chat.userMessage}
          </div>
        </div>
        <div class="message bot">
          <div class="avatar">🤖</div>
          <div class="bubble">
            ${chat.AiResponse}
          </div>
        </div>
      `;
    });

    document.querySelector('.js-chat-window').innerHTML = HTML;

    // Scroll to bottom so user sees latest
    document.querySelector('.js-chat-window').scrollTop = document.querySelector('.js-chat-window').scrollHeight;

  } catch (error) {
    console.log(error);
  }
}

// Call history loader on page load
document.addEventListener('DOMContentLoaded', loadChatHistory);



//couple of problems when you send a message user message appears only once the response appears also while one response is loading you can send another which is bad



//WORKING CODE
/*
// Function to load all saved chat history on page load
async function loadChatHistory() {
  try {
    let user = JSON.parse(localStorage.getItem('user'));
    let userId = user.data.user._id;
    let ideaId = JSON.parse(localStorage.getItem('ideaId'));

    let history = await axios.get(`/api/save/getAllChats/${userId}/${ideaId}`);
    let chats = history.data.savedChat || [];

    let HTML = '';
    chats.forEach(chat => {
      HTML += generateChatBubbles(chat.userMessage, chat.AiResponse);
    });

    document.querySelector('.js-chat-window').innerHTML = HTML;

    // Scroll to bottom
    document.querySelector('.js-chat-window').scrollTop =
      document.querySelector('.js-chat-window').scrollHeight;

  } catch (error) {
    console.log(error);
  }
}

// Reusable function for chat bubbles
function generateChatBubbles(userText, botText) {
  return `
    <div class="message user">
      <div class="bubble">
        ${userText}
      </div>
    </div>
    <div class="message bot">
      <div class="avatar">🤖</div>
      <div class="bubble">
        ${botText}
      </div>
    </div>
  `;
}

let chatResponse = async () => {
  try {
    let user = JSON.parse(localStorage.getItem('user'));
    let userId = user.data.user._id;
    let ideaId = JSON.parse(localStorage.getItem('ideaId'));

    let scoreboard = await axios.get(`/api/save/saveScoreResponse/${userId}/${ideaId}`);
    scoreboard = scoreboard.data.scoreResponse.scoreboardResponse;

    let idea = await axios.get(`/api/save/idea/${userId}/${ideaId}`);
    idea = idea.data.idea.idea;

    let userInput = document.querySelector('.chat-input').value;

    // get previous responses
    let historyResponses = await axios.get(`api/save/getChat/${userId}/${ideaId}`);
    let lastUserResponse = '';
    let lastAiResponse = '';

    const saved = historyResponses.data?.savedChat || null;
    if (saved) {
      lastUserResponse = historyResponses.data.savedChat.userMessage;
      lastAiResponse = historyResponses.data.savedChat.AiResponse;
    }

    let response = await axios.post('/api/responses/chat', {
      scoreboard,
      idea,
      lastUserResponse,
      lastAiResponse,
      userInput
    });
    response = JSON.parse(response.data.result);
    let reply = response.reply;
    let userMessage = response.user_summary;
    let AiResponse = response.assistant_summary;

    // Append new messages instead of replacing
    document.querySelector('.js-chat-window').innerHTML += generateChatBubbles(userInput, reply);

    // Scroll to bottom
    document.querySelector('.js-chat-window').scrollTop =
      document.querySelector('.js-chat-window').scrollHeight;

    // Save responses
    await axios.post('api/save/chat', { userMessage, AiResponse, ideaId, userId });

  } catch (error) {
    console.log(error);
  }
};

// Load chat history when page loads
document.addEventListener('DOMContentLoaded', loadChatHistory);

document.querySelector('.js-send').addEventListener('click', () => {
  chatResponse();
});
*/