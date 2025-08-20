// set-axios-defaults.js
const token = localStorage.getItem('accessToken');
if (!token) {
  window.location.href = 'auth.html';
} else {
  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

const sendBtn = document.querySelector('.js-send');
const inputEl = document.querySelector('.chat-input');

let isBusy = false;

function setBusy(state) {
  isBusy = state;

  // lock/unlock controls
  sendBtn.disabled = state;
  inputEl.disabled = state;
  document.querySelectorAll('.quick-btn').forEach(b => b.disabled = state);

  // visual: loader vs arrow
  sendBtn.classList.toggle('is-busy', state);
  sendBtn.innerHTML = state ? '<span class="loader"></span>' : '➤';
}


let chatResponse = async ()=>{
  try {

    let ideaId = JSON.parse(localStorage.getItem('ideaId'))


    let scoreboard = await axios.get(`/api/save/saveScoreResponse/${ideaId}`);
    scoreboard = scoreboard.data.scoreResponse.scoreboardResponse

    let idea = await axios.get(`/api/save/idea/${ideaId}`)
    idea = idea.data.idea.idea


    //console.log(scoreboard) //FIGURE OUT WAY TO REMOVE JUSTIFICATION
    //console.log(idea)

    let userInput = document.querySelector('.chat-input').value
    setBusy(true);

    const chatWindow = document.querySelector('.js-chat-window');
    chatWindow.innerHTML += `
      <div class="message user new">
        <div class="bubble">${userInput}</div>
      </div>
      <div class="message bot typing-container" id="ai-typing">
        <div class="avatar">🤖</div>
        <div class="bubble typing">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    chatWindow.scrollTop = chatWindow.scrollHeight;

    document.querySelector('.chat-input').value = ''




    //get previous responses
    let historyResponses = await axios.get(`/api/save/getChat/${ideaId}`)

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


    // Replace typing bubble with AI's real response
    const typingBubble = document.getElementById('ai-typing');
    if (typingBubble) {
      typingBubble.outerHTML = `
        <div class="message bot">
          <div class="avatar">🤖</div>
          <div class="bubble">${reply}</div>
        </div>
      `;
    }

    setTimeout(() => {
      document.querySelectorAll('.message.new').forEach(msg => {
        msg.classList.remove('new');
      });
    }, 400); // slightly longer than animation duration
    

    //saving responses

    
    const saveChatRes = await axios.post('/api/save/chat', {userMessage, AiResponse, ideaId})
    console.log(saveChatRes)

    const saveChatRawRes = await axios.post('/api/save/chatRaw', {userMessage: userInput, AiResponse: reply, ideaId})
    console.log(saveChatRawRes)

    loadChatHistory()

  } catch (error) {
    console.log(error)
  } finally {
    setBusy(false);
  }
}



document.querySelector('.js-send').addEventListener('click', ()=>{
  if (isBusy) return; 
  chatResponse()
})

// Send on Enter
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();           // stop accidental form submits / beeps
    if (!isBusy) chatResponse();  // respects your busy lock + empty check inside chatResponse
  }
});



// Load all saved chat history when page loads
async function loadChatHistory() {
  try {
    let ideaId = JSON.parse(localStorage.getItem('ideaId'));

    let history = await axios.get(`/api/save/getAllChatsRaw/${ideaId}`);
    console.log(history)
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



document.querySelector('.quick-btn-1').addEventListener('click', ()=>{
  let text = document.querySelector('.quick-btn-1').innerHTML
  document.querySelector('.chat-input').value = text
})

document.querySelector('.quick-btn-2').addEventListener('click', ()=>{
  let text = document.querySelector('.quick-btn-2').innerHTML
  document.querySelector('.chat-input').value = text
})

document.querySelector('.quick-btn-3').addEventListener('click', ()=>{
  let text = document.querySelector('.quick-btn-3').innerHTML
  document.querySelector('.chat-input').value = text
})