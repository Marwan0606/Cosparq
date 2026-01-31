import { marked } from 'marked';

axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies

const sendBtn = document.querySelector('.js-send');
const stopBtn = document.querySelector('.js-stop');
const inputEl = document.querySelector('.chat-input');
const inputArea = document.querySelector('.chat-input-area');

let isBusy = false;
let abortController = null;  // For cancelling requests

// Track pending action for approval flow
let pendingAction = null;

// Track active action mode (only set when user clicks an action button)
let activeActionMode = null;

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}


function setBusy(state) {
  isBusy = state;

  // lock/unlock controls
  sendBtn.disabled = state;
  inputEl.disabled = state;
  document.querySelectorAll('.quick-btn').forEach(b => b.disabled = state);

  // visual: toggle between send and stop buttons
  inputArea.classList.toggle('is-busy', state);
  sendBtn.classList.toggle('is-busy', state);
  sendBtn.innerHTML = state ? '<span class="loader"></span>' : '➤';
}

// Stop/cancel message generation
function stopGeneration() {
  if (!isBusy) return;
  
  // Abort the pending request
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  // Remove typing bubble and show cancelled message
  const typingBubble = document.getElementById('ai-typing');
  if (typingBubble) {
    typingBubble.outerHTML = `
      <div class="message bot">
        <div class="avatar">🤖</div>
        <div class="bubble" style="color: #9fa1b2; font-style: italic;">Message cancelled</div>
      </div>
    `;
  }
  
  // Clear pending action if any
  pendingAction = null;
  
  setBusy(false);
  console.log('Generation stopped by user');
}

// Check if message is an approval/cancellation for pending action
function checkActionApproval(userInput) {
  if (!pendingAction) return null;
  
  const lower = userInput.toLowerCase().trim();
  
  // Approval phrases
  const approvalPhrases = ['send it', 'yes', 'approve', 'confirm', 'do it', 'create it', 'generate it', 'go ahead', 'looks good', 'perfect', 'ok', 'okay', 'sure', 'yep', 'yeah'];
  if (approvalPhrases.some(phrase => lower.includes(phrase))) {
    return { approved: true };
  }
  
  // Cancellation phrases
  const cancelPhrases = ['cancel', 'no', 'nevermind', 'never mind', 'stop', 'abort', 'don\'t', 'dont', 'nope'];
  if (cancelPhrases.some(phrase => lower.includes(phrase))) {
    return { approved: false };
  }
  
  return null;
}


let chatResponse = async ()=>{
  // Create new abort controller for this request
  abortController = new AbortController();
  
  // Safety timeout - always clear busy state after 60 seconds max
  const safetyTimeout = setTimeout(() => {
    console.log('Safety timeout: clearing busy state');
    if (abortController) abortController.abort();
    setBusy(false);
    const typingBubble = document.getElementById('ai-typing');
    if (typingBubble) {
      typingBubble.outerHTML = `
        <div class="message bot">
          <div class="avatar">🤖</div>
          <div class="bubble action-error">Request timed out. Please try again.</div>
        </div>
      `;
    }
  }, 60000);

  try {

    let ideaId = JSON.parse(localStorage.getItem('ideaId'))


    let scoreboard = await axios.get(`/api/save/saveScoreResponse/${ideaId}`);
    scoreboard = scoreboard.data.scoreResponse.scoreboardResponse

    let idea = await axios.get(`/api/save/idea/${ideaId}`)
    idea = idea.data.idea.idea


    let userInput = document.querySelector('.chat-input').value
    if (!userInput.trim()) {
      clearTimeout(safetyTimeout);
      return;
    }
    
    setBusy(true);

    //saving userInput response before doing anything
    await axios.post('/api/save/chatRaw', {userMessage: userInput, ideaId})

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

    // Check if this is an action approval response
    const approvalCheck = checkActionApproval(userInput);
    
    let response;
    let replyHtml = '';
    
    if (approvalCheck && pendingAction) {
      // Handle action approval/cancellation
      response = await axios.post('/api/responses/chatWithActions', {
        scoreboard, 
        idea, 
        lastUserResponse, 
        lastAiResponse, 
        userInput, 
        ideaId,
        pendingAction,
        actionApproved: approvalCheck.approved,
        actionModification: null,
        actionMode: activeActionMode
      }, { signal: abortController.signal });
      
      // Clear pending action
      pendingAction = null;
      
      const data = response.data;
      console.log('Action approval response:', data);
      
      if (data.type === 'action_completed') {
        replyHtml = `<div class="action-success">✅ ${data.reply || 'Action completed!'}</div>`;
        if (data.actionResult?.url) {
          replyHtml += `<a href="${data.actionResult.url}" target="_blank" class="action-link">Open →</a>`;
        }
      } else if (data.type === 'action_error') {
        replyHtml = `<div class="action-error">❌ ${data.reply || 'Something went wrong'}</div>`;
      } else {
        replyHtml = marked(data.reply || 'Done!');
      }
    } else {
      // Regular chat with actions detection
      response = await axios.post('/api/responses/chatWithActions', {
        scoreboard, 
        idea, 
        lastUserResponse, 
        lastAiResponse, 
        userInput, 
        ideaId,
        actionMode: activeActionMode
      }, { signal: abortController.signal });
      
      const data = response.data;
      console.log('Chat response:', data);
      
      if (data.type === 'action_preview') {
        // Store pending action for approval flow
        pendingAction = {
          actionType: data.actionType,
          actionData: data.actionData
        };
        
        // Clear action mode since we have a pending action now
        clearActionMode();
        
        // Show preview with action buttons
        replyHtml = `
          <div class="action-preview-container">
            ${data.preview.previewHtml}
            <div class="action-buttons">
              <button class="action-btn approve-btn" onclick="window.approveAction()">✓ Approve</button>
              <button class="action-btn cancel-btn" onclick="window.cancelAction()">✕ Cancel</button>
            </div>
            <p class="action-hint">Or type "yes" to confirm or "cancel" to abort</p>
          </div>
        `;
      } else {
        // Regular message response
        replyHtml = marked(data.reply || '');
      }
    }

    // Replace typing bubble with AI's real response
    const typingBubble = document.getElementById('ai-typing');
    if (typingBubble) {
      typingBubble.outerHTML = `
        <div class="message bot">
          <div class="avatar">🤖</div>
          <div class="bubble">${replyHtml}</div>
        </div>
      `;
    }

    setTimeout(() => {
      document.querySelectorAll('.message.new').forEach(msg => {
        msg.classList.remove('new');
      });
    }, 400);
    
    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Don't reload history immediately - it overwrites current response
    // Only reload after a delay to sync with server
    setTimeout(() => {
      // Don't reload if there's a pending action (user needs to see the buttons)
      if (!pendingAction) {
        // loadChatHistory(); // Disabled to prevent overwriting - messages already shown
      }
    }, 2000);

  } catch (error) {
    // Check if this was a user-initiated cancellation
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      console.log('Request cancelled by user');
      return; // stopGeneration already handled the UI
    }
    
    console.log('Chat error:', error)
    
    // Show error message
    const typingBubble = document.getElementById('ai-typing');
    if (typingBubble) {
      let errorMsg = 'Sorry, something went wrong. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      typingBubble.outerHTML = `
        <div class="message bot">
          <div class="avatar">🤖</div>
          <div class="bubble action-error">${errorMsg}</div>
        </div>
      `;
    }
  } finally {
    clearTimeout(safetyTimeout);
    abortController = null;
    setBusy(false);
  }
}

// Global functions for action buttons
window.approveAction = async () => {
  if (!pendingAction) return;
  document.querySelector('.chat-input').value = 'Yes, do it';
  chatResponse();
};

window.cancelAction = async () => {
  pendingAction = null;
  document.querySelector('.chat-input').value = 'Cancel';
  chatResponse();
};


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

// Stop button click
stopBtn.addEventListener('click', stopGeneration);

let isPolling = false;

// Load all saved chat history when page loads
async function loadChatHistory() {
  try {
    let ideaId = JSON.parse(localStorage.getItem('ideaId'));
    let history = await axios.get(`/api/save/getAllChatsRaw/${ideaId}`);
    console.log(history)
    let chats = history.data.savedChat || [];

    const last = chats[chats.length - 1]; //only check the newest message
    const isLastPending = !!last && (!last.AiResponse || !last.AiResponse.trim());


    let HTML = '';
    chats.forEach((chat, index) => {
      const isLast = index === chats.length - 1;
      const isPending = !chat.AiResponse || !chat.AiResponse.trim();
      
      if (chat.AiResponse && chat.AiResponse.trim().length > 0) {
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
      } else if (isLast && isPending) {
        // Last message is still pending - show loading spinner and poll
        HTML += `
          <div class="message user">
            <div class="bubble">
              ${chat.userMessage}
            </div>
          </div>
          <div class="message bot">
            <div class="avatar">🤖</div>
            <div class="bubble">
              <div class="loading-animation">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Old message that never got a response - show notice
        HTML += `
          <div class="message user">
            <div class="bubble">
              ${chat.userMessage}
            </div>
          </div>
          <div class="message bot">
            <div class="avatar">🤖</div>
            <div class="bubble" style="color: #9fa1b2; font-style: italic;">
              (Response not saved - please resend your message)
            </div>
          </div>
        `;
      }
    });


    document.querySelector('.js-chat-window').innerHTML = HTML;

    // Scroll to bottom so user sees latest
    document.querySelector('.js-chat-window').scrollTop = document.querySelector('.js-chat-window').scrollHeight;

    if (isLastPending) {
      if (isPolling) return;     // don’t double-start
      isPolling = true;
      setTimeout(() => {
        isPolling = false;
        loadChatHistory();        // re-fetch to check if response arrived
      }, 2000);  // Poll every 2 seconds
    }
    
    

  } catch (error) {
    console.log(error);
  }
}

// Call history loader on page load
document.addEventListener('DOMContentLoaded', loadChatHistory);


//couple of problems when you send a message user message appears only once the response appears also while one response is loading you can send another which is bad



// Action button click handlers
const actionPrompts = {
  email: 'I want to send an email. Who should I email and what should it say?',
  calendar: 'I want to schedule an event. What event should I create?',
  slides: 'I want to create a presentation. What should the slides cover?',
  sheets: 'I want to create a spreadsheet. What data should I track?',
  forms: 'I want to create a survey/form. What questions should I include?',
  content: 'I want to generate content. What type of content do you need?'
};

const actionLabels = {
  email: 'Email Mode',
  calendar: 'Calendar Mode',
  slides: 'Slides Mode',
  sheets: 'Sheets Mode',
  forms: 'Forms Mode',
  content: 'Content Mode'
};

// Set up action button listeners
document.querySelectorAll('.action-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isBusy) return;
    
    const action = btn.dataset.action;
    
    // Toggle action mode
    if (activeActionMode === action) {
      // Clicking same button again - deactivate
      clearActionMode();
    } else {
      // Activate this action mode
      setActionMode(action);
    }
  });
});

function setActionMode(action) {
  activeActionMode = action;
  
  // Update UI to show active mode
  document.querySelectorAll('.action-quick-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.action === action);
  });
  
  // Update input placeholder
  const placeholders = {
    email: 'Describe the email: who to send to, subject, and message...',
    calendar: 'Describe the event: title, date, time, and any attendees...',
    slides: 'Describe your presentation: topic, purpose, key points...',
    sheets: 'Describe the spreadsheet: what data to track, columns needed...',
    forms: 'Describe the form: purpose, questions to ask...',
    content: 'Describe the content: type (blog, social, etc), topic, tone...'
  };
  inputEl.placeholder = placeholders[action] || 'Describe what you need...';
  
  // Show mode indicator
  showModeIndicator(action);
  
  // Focus input
  inputEl.focus();
}

function clearActionMode() {
  activeActionMode = null;
  
  // Remove active state from all buttons
  document.querySelectorAll('.action-quick-btn').forEach(b => {
    b.classList.remove('active');
  });
  
  // Reset placeholder
  inputEl.placeholder = 'Ask anything about your startup idea...';
  
  // Remove mode indicator
  hideModeIndicator();
}

function showModeIndicator(action) {
  let indicator = document.querySelector('.mode-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    document.querySelector('.chat-input-area').prepend(indicator);
  }
  indicator.innerHTML = `${actionLabels[action]} <button class="mode-clear" onclick="window.clearActionMode()">✕</button>`;
  indicator.style.display = 'flex';
}

function hideModeIndicator() {
  const indicator = document.querySelector('.mode-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// Expose clearActionMode globally for the X button
window.clearActionMode = clearActionMode;