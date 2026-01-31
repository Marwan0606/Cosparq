// Actions Page - Frontend Logic
axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;

// State
let currentIdea = null;
let googleConnected = false;

// DOM Elements
const ideaContext = document.getElementById('currentIdeaName');
const googleStatus = document.getElementById('googleStatus');
const connectGoogleBtn = document.getElementById('connectGoogleBtn');
const disconnectGoogleBtn = document.getElementById('disconnectGoogleBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const historyList = document.getElementById('historyList');
const toast = document.getElementById('toast');

// Initialize
async function init() {
  await loadCurrentIdea();
  await checkGoogleConnection();
  await loadActionHistory();
  setupEventListeners();
}

// Load current idea from localStorage (same as cofounder-chat)
async function loadCurrentIdea() {
  try {
    const ideaId = JSON.parse(localStorage.getItem('ideaId'));
    if (!ideaId) {
      ideaContext.textContent = 'No idea selected';
      return;
    }
    
    const response = await axios.get(`/api/save/idea/${ideaId}`);
    if (response.data && response.data.idea) {
      currentIdea = {
        id: ideaId,
        name: response.data.idea.ideaName || 'Your App',
        text: response.data.idea.idea
      };
      // Display the app name instead of the full idea
      ideaContext.textContent = currentIdea.name;
    }
  } catch (error) {
    console.error('Error loading idea:', error);
    ideaContext.textContent = 'Error loading idea';
  }
}

// Check if user has Google connected
async function checkGoogleConnection() {
  try {
    const response = await axios.get('/api/google/status');
    googleConnected = response.data.connected;
    updateGoogleUI();
  } catch (error) {
    console.error('Error checking Google connection:', error);
    googleConnected = false;
    updateGoogleUI();
  }
}

function updateGoogleUI() {
  if (googleConnected) {
    googleStatus.textContent = 'Connected';
    googleStatus.classList.add('connected');
    connectGoogleBtn.classList.add('hidden');
    disconnectGoogleBtn.classList.remove('hidden');
    
    // Enable Google-dependent actions
    document.querySelectorAll('[data-requires="google"]').forEach(card => {
      card.classList.remove('disabled');
    });
  } else {
    googleStatus.textContent = 'Not connected';
    googleStatus.classList.remove('connected');
    connectGoogleBtn.classList.remove('hidden');
    disconnectGoogleBtn.classList.add('hidden');
    
    // Disable Google-dependent actions
    document.querySelectorAll('[data-requires="google"]').forEach(card => {
      card.classList.add('disabled');
    });
  }
}

// Load action history
async function loadActionHistory() {
  try {
    const ideaId = JSON.parse(localStorage.getItem('ideaId'));
    if (!ideaId) return;
    
    const response = await axios.get(`/api/actions/history/${ideaId}`);
    const history = response.data.history || [];
    
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <p>No actions yet. Start by creating an email or scheduling an event!</p>
        </div>
      `;
      return;
    }
    
    // Only show the last 5 actions (should already be limited by backend, but double check)
    const lastFive = history.slice(0, 5);
    historyList.innerHTML = lastFive.map(item => `
      <div class="history-item">
        <div class="history-info">
          <div class="history-icon">
            ${getActionIcon(item.type)}
          </div>
          <div class="history-details">
            <h4>${item.title}</h4>
            <p>${formatDate(item.createdAt)}</p>
          </div>
        </div>
        <span class="history-status ${item.status}">${item.status}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

function getActionIcon(type) {
  const icons = {
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    slides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    sheets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>'
  };
  return icons[type] || icons.content;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Event Listeners
function setupEventListeners() {
  // Connect Google button
  connectGoogleBtn.addEventListener('click', () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      '/api/google/auth',
      'google-auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'google-auth-success') {
        popup.close();
        await checkGoogleConnection();
        showToast('Google account connected!', 'success');
      } else if (event.data.type === 'google-auth-error') {
        popup.close();
        showToast('Failed to connect Google account', 'error');
      }
    });
  });
  
  // Disconnect Google button
  disconnectGoogleBtn.addEventListener('click', async () => {
    try {
      await axios.post('/api/google/disconnect');
      googleConnected = false;
      updateGoogleUI();
      showToast('Google account disconnected', 'success');
    } catch (error) {
      showToast('Failed to disconnect', 'error');
    }
  });
  
  // Action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      openActionModal(action);
    });
  });
  
  // Modal close
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// Modal Functions
function openActionModal(action) {
  let content = '';
  
  switch (action) {
    case 'email':
      content = getEmailPromptModal();
      break;
    case 'calendar':
      content = getCalendarPromptModal();
      break;
    case 'content':
      content = getContentModalContent();
      break;
    case 'slides':
      content = getSlidesPromptModal();
      break;
    case 'forms':
      content = getFormsPromptModal();
      break;
    case 'sheets':
      content = getSheetsPromptModal();
      break;
    default:
      return;
  }
  
  modalContent.innerHTML = content;
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  setupModalHandlers(action);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// ============== AI-DRIVEN EMAIL FLOW ==============
function getEmailPromptModal(sendDirectly = true) {
  const title = sendDirectly ? 'Send Email' : 'Draft Email';
  const subtitle = sendDirectly 
    ? 'Tell AI what email you want to send' 
    : 'Describe the email you need';
  
  return `
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      <p class="modal-subtitle">${subtitle}</p>
    </div>
    
    <div id="emailPromptStep" class="modal-step">
      <div class="form-group">
        <label class="form-label">What do you want to send?</label>
        <textarea class="form-textarea prompt-input" id="emailPrompt" placeholder="Example: Send a cold email to john@techstartup.com introducing my app and asking if they'd be interested in a partnership...

Or: Write a follow-up email to investor@vc.com thanking them for the meeting yesterday..."></textarea>
      </div>
      
      <button type="button" class="submit-btn" id="generateEmailBtn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Generate Email
      </button>
    </div>
    
    <div id="emailReviewStep" class="modal-step hidden">
      <div class="review-section">
        <div class="review-field">
          <label class="form-label">To</label>
          <input type="email" class="form-input" id="reviewEmailTo" placeholder="recipient@example.com">
        </div>
        
        <div class="review-field">
          <label class="form-label">Subject</label>
          <input type="text" class="form-input" id="reviewEmailSubject">
        </div>
        
        <div class="review-field">
          <label class="form-label">Body</label>
          <textarea class="form-textarea" id="reviewEmailBody" style="min-height: 180px;"></textarea>
        </div>
      </div>
      
      <div class="review-actions">
        <button type="button" class="secondary-btn" id="backToPromptBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button type="button" class="submit-btn" id="approveEmailBtn" data-send="${sendDirectly}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          ${sendDirectly ? 'Approve & Send' : 'Copy to Clipboard'}
        </button>
      </div>
    </div>
  `;
}

// ============== AI-DRIVEN CALENDAR FLOW ==============
// Store events for the calendar organizer
let calendarEvents = [];

function getCalendarPromptModal() {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Organize Calendar</h2>
      <p class="modal-subtitle">Tell AI how you want to organize your schedule</p>
    </div>
    
    <div id="calendarPromptStep" class="modal-step">
      <div class="form-group">
        <label class="form-label">What do you want to plan?</label>
        <textarea class="form-textarea prompt-input" id="calendarPrompt" placeholder="Examples:

• Plan my week with daily standups, 2 coding blocks, and a customer call on Thursday

• Set up a launch schedule for next week with prep days, launch day, and follow-up tasks

• Create a sprint with planning on Monday, 3 development days, and a demo on Friday

• Schedule daily focus time from 9-11am for the next 5 days"></textarea>
      </div>
      
      <button type="button" class="submit-btn" id="generateEventsBtn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Plan My Schedule
      </button>
    </div>
    
    <div id="calendarReviewStep" class="modal-step hidden">
      <div class="events-summary">
        <span id="eventsCount">0 events</span>
        <button type="button" class="select-all-btn" id="selectAllBtn">Select All</button>
      </div>
      
      <div class="events-list" id="eventsList">
        <!-- Events will be populated here -->
      </div>
      
      <div class="review-actions">
        <button type="button" class="secondary-btn" id="backToCalendarPromptBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button type="button" class="submit-btn" id="approveEventsBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Add Selected to Calendar
        </button>
      </div>
    </div>
  `;
}

function renderEventsList() {
  const eventsList = document.getElementById('eventsList');
  const selectedCount = calendarEvents.filter(e => e.selected).length;
  document.getElementById('eventsCount').textContent = `${selectedCount} of ${calendarEvents.length} events selected`;
  
  eventsList.innerHTML = calendarEvents.map((event, index) => {
    const dateObj = new Date(event.date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Format time for display
    const [hours, mins] = event.time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const timeDisplay = `${hour12}:${mins} ${ampm}`;
    
    // Duration display
    const durationMins = parseInt(event.duration);
    const durationDisplay = durationMins >= 60 
      ? `${durationMins / 60}h` 
      : `${durationMins}m`;
    
    return `
      <div class="event-card ${event.selected ? 'selected' : ''}" data-index="${index}">
        <div class="event-checkbox">
          <input type="checkbox" id="event-${index}" ${event.selected ? 'checked' : ''}>
        </div>
        <div class="event-date-badge">
          <span class="event-day">${dayName}</span>
          <span class="event-date">${monthDay}</span>
        </div>
        <div class="event-details">
          <h4 class="event-title">${event.title}</h4>
          <div class="event-meta">
            <span class="event-time">${timeDisplay}</span>
            <span class="event-duration">${durationDisplay}</span>
          </div>
          ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
        </div>
        <button type="button" class="event-edit-btn" data-index="${index}" title="Edit event">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  eventsList.querySelectorAll('.event-card').forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    const index = parseInt(card.dataset.index);
    
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      calendarEvents[index].selected = checkbox.checked;
      card.classList.toggle('selected', checkbox.checked);
      updateEventsCount();
    });
    
    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && !e.target.closest('.event-edit-btn')) {
        checkbox.checked = !checkbox.checked;
        calendarEvents[index].selected = checkbox.checked;
        card.classList.toggle('selected', checkbox.checked);
        updateEventsCount();
      }
    });
  });
  
  // Edit buttons
  eventsList.querySelectorAll('.event-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      openEventEditor(index);
    });
  });
}

function updateEventsCount() {
  const selectedCount = calendarEvents.filter(e => e.selected).length;
  document.getElementById('eventsCount').textContent = `${selectedCount} of ${calendarEvents.length} events selected`;
}

function openEventEditor(index) {
  const event = calendarEvents[index];
  const card = document.querySelector(`.event-card[data-index="${index}"]`);
  
  // Replace card content with editor
  card.innerHTML = `
    <div class="event-editor">
      <div class="editor-row">
        <input type="text" class="form-input" value="${event.title}" id="edit-title-${index}" placeholder="Event title">
      </div>
      <div class="editor-row">
        <input type="date" class="form-input" value="${event.date}" id="edit-date-${index}">
        <input type="time" class="form-input" value="${event.time}" id="edit-time-${index}">
        <select class="form-select" id="edit-duration-${index}">
          <option value="30" ${event.duration === '30' ? 'selected' : ''}>30m</option>
          <option value="60" ${event.duration === '60' ? 'selected' : ''}>1h</option>
          <option value="90" ${event.duration === '90' ? 'selected' : ''}>1.5h</option>
          <option value="120" ${event.duration === '120' ? 'selected' : ''}>2h</option>
          <option value="180" ${event.duration === '180' ? 'selected' : ''}>3h</option>
        </select>
      </div>
      <div class="editor-row">
        <input type="text" class="form-input" value="${event.description || ''}" id="edit-desc-${index}" placeholder="Description (optional)">
      </div>
      <div class="editor-actions">
        <button type="button" class="editor-save-btn" data-index="${index}">Save</button>
        <button type="button" class="editor-cancel-btn" data-index="${index}">Cancel</button>
        <button type="button" class="editor-delete-btn" data-index="${index}">Delete</button>
      </div>
    </div>
  `;
  
  card.classList.add('editing');
  
  // Save handler
  card.querySelector('.editor-save-btn').addEventListener('click', () => {
    calendarEvents[index] = {
      ...calendarEvents[index],
      title: document.getElementById(`edit-title-${index}`).value,
      date: document.getElementById(`edit-date-${index}`).value,
      time: document.getElementById(`edit-time-${index}`).value,
      duration: document.getElementById(`edit-duration-${index}`).value,
      description: document.getElementById(`edit-desc-${index}`).value
    };
    renderEventsList();
  });
  
  // Cancel handler
  card.querySelector('.editor-cancel-btn').addEventListener('click', () => {
    renderEventsList();
  });
  
  // Delete handler
  card.querySelector('.editor-delete-btn').addEventListener('click', () => {
    calendarEvents.splice(index, 1);
    renderEventsList();
  });
}

function getContentModalContent() {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Generate Content</h2>
      <p class="modal-subtitle">Create marketing content for your startup idea</p>
    </div>
    
    <form id="contentForm">
      <div class="form-group">
        <label class="form-label">Content Type</label>
        <select class="form-select" id="contentType">
          <option value="twitter-thread">Twitter/X Thread</option>
          <option value="linkedin-post">LinkedIn Post</option>
          <option value="product-hunt">Product Hunt Launch</option>
          <option value="blog-outline">Blog Post Outline</option>
          <option value="landing-copy">Landing Page Copy</option>
          <option value="elevator-pitch">Elevator Pitch</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Tone</label>
        <select class="form-select" id="contentTone">
          <option value="professional">Professional</option>
          <option value="casual">Casual & Friendly</option>
          <option value="exciting">Exciting & Bold</option>
          <option value="informative">Informative</option>
          <option value="humorous">Humorous</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Key Points to Highlight (optional)</label>
        <textarea class="form-textarea" id="contentPoints" placeholder="Main features, benefits, or messages..."></textarea>
      </div>
      
      <button type="submit" class="submit-btn" id="contentSubmitBtn">
        Generate Content
      </button>
    </form>
    
    <div class="output-section hidden" id="contentOutput">
      <p class="output-label">Generated Content</p>
      <div class="output-box" id="contentResult"></div>
      <button type="button" class="copy-btn" id="copyContentBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>Copy to Clipboard</span>
      </button>
    </div>
  `;
}

// Modal Handlers
function setupModalHandlers(action) {
  switch (action) {
    case 'email':
      setupEmailPromptHandlers(true);
      break;
    case 'calendar':
      setupCalendarPromptHandlers();
      break;
    case 'content':
      setupContentHandlers();
      break;
    case 'slides':
      setupSlidesPromptHandlers();
      break;
    case 'forms':
      setupFormsPromptHandlers();
      break;
    case 'sheets':
      setupSheetsPromptHandlers();
      break;
  }
}

// ============== EMAIL PROMPT HANDLERS ==============
function setupEmailPromptHandlers(sendDirectly) {
  const promptStep = document.getElementById('emailPromptStep');
  const reviewStep = document.getElementById('emailReviewStep');
  const generateBtn = document.getElementById('generateEmailBtn');
  const backBtn = document.getElementById('backToPromptBtn');
  const approveBtn = document.getElementById('approveEmailBtn');
  const promptInput = document.getElementById('emailPrompt');
  
  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showToast('Please describe the email you want to send', 'error');
      return;
    }
    
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div><span>AI is writing your email...</span>';
    
    try {
      const response = await axios.post('/api/actions/ai-compose-email', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        prompt: prompt
      });
      
      document.getElementById('reviewEmailTo').value = response.data.to || '';
      document.getElementById('reviewEmailSubject').value = response.data.subject || '';
      document.getElementById('reviewEmailBody').value = response.data.body || '';
      
      promptStep.classList.add('hidden');
      reviewStep.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate email', 'error');
    }
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Generate Email
    `;
  });
  
  backBtn.addEventListener('click', () => {
    reviewStep.classList.add('hidden');
    promptStep.classList.remove('hidden');
  });
  
  approveBtn.addEventListener('click', async () => {
    const to = document.getElementById('reviewEmailTo').value;
    const subject = document.getElementById('reviewEmailSubject').value;
    const body = document.getElementById('reviewEmailBody').value;
    
    if (!to || !body) {
      showToast('Please fill in recipient and body', 'error');
      return;
    }
    
    if (sendDirectly) {
      approveBtn.disabled = true;
      approveBtn.innerHTML = '<div class="spinner"></div><span>Sending...</span>';
      
      try {
        await axios.post('/api/actions/send-email', {
          ideaId: currentIdea?.id,
          to,
          subject,
          body
        });
        
        showToast('Email sent successfully!', 'success');
        closeModal();
        await loadActionHistory();
      } catch (error) {
        showToast(error.response?.data?.message || 'Failed to send email', 'error');
      }
      
      approveBtn.disabled = false;
      approveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Approve & Send
      `;
    } else {
      const fullEmail = `To: ${to}\nSubject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(fullEmail);
      
      try {
        await axios.post('/api/actions/log', {
          ideaId: currentIdea?.id,
          type: 'draft-email',
          title: `Draft: ${subject.substring(0, 40)}...`,
          data: { to, subject, body }
        });
        await loadActionHistory();
      } catch (error) {
        console.error('Failed to log action:', error);
      }
      
      showToast('Email copied to clipboard!', 'success');
      closeModal();
    }
  });
}

// ============== CALENDAR PROMPT HANDLERS ==============
function setupCalendarPromptHandlers() {
  const promptStep = document.getElementById('calendarPromptStep');
  const reviewStep = document.getElementById('calendarReviewStep');
  const generateBtn = document.getElementById('generateEventsBtn');
  const backBtn = document.getElementById('backToCalendarPromptBtn');
  const approveBtn = document.getElementById('approveEventsBtn');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const promptInput = document.getElementById('calendarPrompt');
  
  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showToast('Please describe what you want to plan', 'error');
      return;
    }
    
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div><span>AI is organizing your schedule...</span>';
    
    try {
      const response = await axios.post('/api/actions/ai-organize-calendar', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        prompt: prompt
      });
      
      calendarEvents = response.data.events || [];
      
      if (calendarEvents.length === 0) {
        showToast('No events generated. Try a different prompt.', 'error');
        return;
      }
      
      renderEventsList();
      promptStep.classList.add('hidden');
      reviewStep.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate schedule', 'error');
    }
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Plan My Schedule
    `;
  });
  
  selectAllBtn.addEventListener('click', () => {
    const allSelected = calendarEvents.every(e => e.selected);
    calendarEvents.forEach(e => e.selected = !allSelected);
    renderEventsList();
    selectAllBtn.textContent = allSelected ? 'Select All' : 'Deselect All';
  });
  
  backBtn.addEventListener('click', () => {
    reviewStep.classList.add('hidden');
    promptStep.classList.remove('hidden');
    calendarEvents = [];
  });
  
  approveBtn.addEventListener('click', async () => {
    const selectedEvents = calendarEvents.filter(e => e.selected);
    
    if (selectedEvents.length === 0) {
      showToast('Please select at least one event', 'error');
      return;
    }
    
    approveBtn.disabled = true;
    approveBtn.innerHTML = `<div class="spinner"></div><span>Adding ${selectedEvents.length} events...</span>`;
    
    try {
      const response = await axios.post('/api/actions/create-multiple-events', {
        ideaId: currentIdea?.id,
        events: selectedEvents.map(e => ({
          title: e.title,
          date: e.date,
          time: e.time,
          duration: e.duration,
          description: e.description
        }))
      });
      
      showToast(response.data.message || `Added ${selectedEvents.length} events to calendar!`, 'success');
      closeModal();
      calendarEvents = [];
      await loadActionHistory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create events', 'error');
    }
    
    approveBtn.disabled = false;
    approveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Add Selected to Calendar
    `;
  });
}

// ============== GOOGLE SLIDES FLOW ==============
let slideContent = null;

function getSlidesPromptModal() {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Plan Your Pitch Deck</h2>
      <p class="modal-subtitle">AI will create a detailed slide structure with content — you add designs & images</p>
    </div>
    
    <div class="planning-notice">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
      <span>This creates a <strong>content outline</strong> with titles, bullet points, and speaker notes. Add your own designs, colors, and images in Google Slides.</span>
    </div>
    
    <div id="slidesPromptStep" class="modal-step">
      <div class="form-group">
        <label class="form-label">Presentation Type</label>
        <select class="form-select" id="presentationType">
          <option value="pitch-deck">Pitch Deck (Problem, Solution, Market, etc.)</option>
          <option value="product-demo">Product Demo</option>
          <option value="investor-update">Investor Update</option>
          <option value="team-intro">Team Introduction</option>
          <option value="custom">Custom Presentation</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Additional Instructions (optional)</label>
        <textarea class="form-textarea prompt-input" id="slidesPrompt" placeholder="Example: Focus on our AI technology, include a slide about our competitive advantage, mention we're seeking $500K seed funding..."></textarea>
      </div>
      
      <button type="button" class="submit-btn" id="generateSlidesBtn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Plan My Slides
      </button>
    </div>
    
    <div id="slidesReviewStep" class="modal-step hidden">
      <div class="slides-preview" id="slidesPreview">
        <!-- Slides preview will be populated here -->
      </div>
      
      <div class="review-actions">
        <button type="button" class="secondary-btn" id="backToSlidesPromptBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button type="button" class="submit-btn" id="createSlidesBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Create in Google Slides
        </button>
      </div>
    </div>
  `;
}

function renderSlidesPreview() {
  const preview = document.getElementById('slidesPreview');
  if (!slideContent || !slideContent.slides) {
    preview.innerHTML = '<p class="preview-empty">No slides generated</p>';
    return;
  }
  
  preview.innerHTML = `
    <h3 class="slides-title">${slideContent.title}</h3>
    <div class="slides-list">
      ${slideContent.slides.map((slide, index) => `
        <div class="slide-card">
          <div class="slide-number">${index + 1}</div>
          <div class="slide-content">
            <h4 class="slide-title">${slide.title}</h4>
            <ul class="slide-bullets">
              ${slide.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
            </ul>
            ${slide.speakerNotes ? `<p class="slide-notes"><em>Notes: ${slide.speakerNotes}</em></p>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupSlidesPromptHandlers() {
  const promptStep = document.getElementById('slidesPromptStep');
  const reviewStep = document.getElementById('slidesReviewStep');
  const generateBtn = document.getElementById('generateSlidesBtn');
  const backBtn = document.getElementById('backToSlidesPromptBtn');
  const createBtn = document.getElementById('createSlidesBtn');
  const promptInput = document.getElementById('slidesPrompt');
  const typeSelect = document.getElementById('presentationType');
  
  generateBtn.addEventListener('click', async () => {
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div><span>AI is designing your presentation...</span>';
    
    try {
      const response = await axios.post('/api/actions/ai-generate-slides', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        prompt: promptInput.value.trim(),
        presentationType: typeSelect.value
      });
      
      slideContent = response.data.slideContent;
      
      if (!slideContent || !slideContent.slides) {
        showToast('Failed to generate slides. Try again.', 'error');
        return;
      }
      
      renderSlidesPreview();
      promptStep.classList.add('hidden');
      reviewStep.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate slides', 'error');
    }
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Generate Slides
    `;
  });
  
  backBtn.addEventListener('click', () => {
    reviewStep.classList.add('hidden');
    promptStep.classList.remove('hidden');
    slideContent = null;
  });
  
  createBtn.addEventListener('click', async () => {
    if (!slideContent) {
      showToast('No slides to create', 'error');
      return;
    }
    
    createBtn.disabled = true;
    createBtn.innerHTML = '<div class="spinner"></div><span>Creating presentation...</span>';
    
    try {
      const response = await axios.post('/api/actions/create-google-slides', {
        ideaId: currentIdea?.id,
        slideContent: slideContent
      });
      
      showToast(`Created ${response.data.slideCount} slides!`, 'success');
      
      // Open the presentation in a new tab
      if (response.data.presentationUrl) {
        window.open(response.data.presentationUrl, '_blank');
      }
      
      closeModal();
      slideContent = null;
      await loadActionHistory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create presentation', 'error');
    }
    
    createBtn.disabled = false;
    createBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Create in Google Slides
    `;
  });
}

// ============== GOOGLE FORMS FLOW ==============
let formContent = null;

function getFormsPromptModal() {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Create Survey</h2>
      <p class="modal-subtitle">AI will generate a complete Google Form</p>
    </div>
    
    <div id="formsPromptStep" class="modal-step">
      <div class="form-group">
        <label class="form-label">Form Type</label>
        <select class="form-select" id="formType">
          <option value="customer-feedback">Customer Feedback</option>
          <option value="market-research">Market Research</option>
          <option value="user-interview">User Interview Questions</option>
          <option value="beta-signup">Beta Signup Form</option>
          <option value="feature-request">Feature Request</option>
          <option value="nps-survey">NPS Survey</option>
          <option value="custom">Custom Form</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Additional Instructions (optional)</label>
        <textarea class="form-textarea prompt-input" id="formsPrompt" placeholder="Example: Focus on understanding pricing expectations, ask about competitor products they use, include a question about their biggest pain point..."></textarea>
      </div>
      
      <button type="button" class="submit-btn" id="generateFormBtn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Generate Form
      </button>
    </div>
    
    <div id="formsReviewStep" class="modal-step hidden">
      <div class="form-preview" id="formPreview">
        <!-- Form preview will be populated here -->
      </div>
      
      <div class="review-actions">
        <button type="button" class="secondary-btn" id="backToFormsPromptBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button type="button" class="submit-btn" id="createFormBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Create Google Form
        </button>
      </div>
    </div>
  `;
}

function renderFormPreview() {
  const preview = document.getElementById('formPreview');
  if (!formContent || !formContent.questions) {
    preview.innerHTML = '<p class="preview-empty">No form generated</p>';
    return;
  }
  
  const questionTypeLabels = {
    'SHORT_ANSWER': 'Short Answer',
    'PARAGRAPH': 'Paragraph',
    'MULTIPLE_CHOICE': 'Multiple Choice',
    'CHECKBOX': 'Checkboxes',
    'SCALE': 'Scale'
  };
  
  preview.innerHTML = `
    <h3 class="form-title">${formContent.title}</h3>
    ${formContent.description ? `<p class="form-description">${formContent.description}</p>` : ''}
    <div class="questions-list">
      ${formContent.questions.map((q, index) => `
        <div class="question-card">
          <div class="question-header">
            <span class="question-number">${index + 1}</span>
            <span class="question-type">${questionTypeLabels[q.type] || q.type}</span>
            ${q.required ? '<span class="question-required">Required</span>' : ''}
          </div>
          <p class="question-text">${q.title}</p>
          ${q.options ? `
            <ul class="question-options">
              ${q.options.map(opt => `<li>${opt}</li>`).join('')}
            </ul>
          ` : ''}
          ${q.type === 'SCALE' ? `
            <div class="question-scale">
              <span>${q.scaleLowLabel || q.scaleMin || 1}</span>
              <span>→</span>
              <span>${q.scaleHighLabel || q.scaleMax || 5}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function setupFormsPromptHandlers() {
  const promptStep = document.getElementById('formsPromptStep');
  const reviewStep = document.getElementById('formsReviewStep');
  const generateBtn = document.getElementById('generateFormBtn');
  const backBtn = document.getElementById('backToFormsPromptBtn');
  const createBtn = document.getElementById('createFormBtn');
  const promptInput = document.getElementById('formsPrompt');
  const typeSelect = document.getElementById('formType');
  
  generateBtn.addEventListener('click', async () => {
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div><span>AI is creating your form...</span>';
    
    try {
      const response = await axios.post('/api/actions/ai-generate-form', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        prompt: promptInput.value.trim(),
        formType: typeSelect.value
      });
      
      formContent = response.data.formContent;
      
      if (!formContent || !formContent.questions) {
        showToast('Failed to generate form. Try again.', 'error');
        return;
      }
      
      renderFormPreview();
      promptStep.classList.add('hidden');
      reviewStep.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate form', 'error');
    }
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Generate Form
    `;
  });
  
  backBtn.addEventListener('click', () => {
    reviewStep.classList.add('hidden');
    promptStep.classList.remove('hidden');
    formContent = null;
  });
  
  createBtn.addEventListener('click', async () => {
    if (!formContent) {
      showToast('No form to create', 'error');
      return;
    }
    
    createBtn.disabled = true;
    createBtn.innerHTML = '<div class="spinner"></div><span>Creating form...</span>';
    
    try {
      const response = await axios.post('/api/actions/create-google-form', {
        ideaId: currentIdea?.id,
        formContent: formContent
      });
      
      showToast(`Created form with ${response.data.questionCount} questions!`, 'success');
      
      // Open the form in a new tab
      if (response.data.editUrl) {
        window.open(response.data.editUrl, '_blank');
      }
      
      closeModal();
      formContent = null;
      await loadActionHistory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create form', 'error');
    }
    
    createBtn.disabled = false;
    createBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Create Google Form
    `;
  });
}

// ============== GOOGLE SHEETS FLOW ==============
let sheetContent = null;

function getSheetsPromptModal() {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Create Spreadsheet</h2>
      <p class="modal-subtitle">AI will create a structured Google Sheet for your startup</p>
    </div>
    
    <div id="sheetsPromptStep" class="modal-step">
      <div class="form-group">
        <label class="form-label">Spreadsheet Type</label>
        <select class="form-select" id="sheetType">
          <option value="task-tracker">Task/Project Tracker</option>
          <option value="budget-tracker">Budget & Expense Tracker</option>
          <option value="competitor-analysis">Competitor Analysis</option>
          <option value="customer-feedback">Customer Feedback Tracker</option>
          <option value="okr-tracker">OKR Tracker</option>
          <option value="sales-pipeline">Sales/Leads Pipeline</option>
          <option value="content-calendar">Content Calendar</option>
          <option value="custom">Custom Spreadsheet</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Additional Instructions (optional)</label>
        <textarea class="form-textarea prompt-input" id="sheetsPrompt" placeholder="Example: Include columns for estimated vs actual costs, add a sheet for monthly summaries, track by department..."></textarea>
      </div>
      
      <button type="button" class="submit-btn" id="generateSheetBtn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Generate Spreadsheet
      </button>
    </div>
    
    <div id="sheetsReviewStep" class="modal-step hidden">
      <div class="sheet-preview" id="sheetPreview">
        <!-- Sheet preview will be populated here -->
      </div>
      
      <div class="review-actions">
        <button type="button" class="secondary-btn" id="backToSheetsPromptBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button type="button" class="submit-btn" id="createSheetBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Create Google Sheet
        </button>
      </div>
    </div>
  `;
}

function renderSheetPreview() {
  const preview = document.getElementById('sheetPreview');
  if (!sheetContent || !sheetContent.sheets) {
    preview.innerHTML = '<p class="preview-empty">No spreadsheet generated</p>';
    return;
  }
  
  preview.innerHTML = `
    <h3 class="sheet-title">${sheetContent.title}</h3>
    <div class="sheets-list">
      ${sheetContent.sheets.map((sheet, sheetIndex) => `
        <div class="sheet-card">
          <h4 class="sheet-name">${sheet.name}</h4>
          <div class="sheet-table-wrapper">
            <table class="sheet-table">
              <thead>
                <tr>
                  ${sheet.headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${sheet.rows.slice(0, 5).map(row => `
                  <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                  </tr>
                `).join('')}
                ${sheet.rows.length > 5 ? `
                  <tr class="more-rows">
                    <td colspan="${sheet.headers.length}">+ ${sheet.rows.length - 5} more rows...</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupSheetsPromptHandlers() {
  const promptStep = document.getElementById('sheetsPromptStep');
  const reviewStep = document.getElementById('sheetsReviewStep');
  const generateBtn = document.getElementById('generateSheetBtn');
  const backBtn = document.getElementById('backToSheetsPromptBtn');
  const createBtn = document.getElementById('createSheetBtn');
  const promptInput = document.getElementById('sheetsPrompt');
  const typeSelect = document.getElementById('sheetType');
  
  generateBtn.addEventListener('click', async () => {
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div><span>AI is creating your spreadsheet...</span>';
    
    try {
      const response = await axios.post('/api/actions/ai-generate-sheet', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        prompt: promptInput.value.trim(),
        sheetType: typeSelect.value
      });
      
      sheetContent = response.data.sheetContent;
      
      if (!sheetContent || !sheetContent.sheets) {
        showToast('Failed to generate spreadsheet. Try again.', 'error');
        return;
      }
      
      renderSheetPreview();
      promptStep.classList.add('hidden');
      reviewStep.classList.remove('hidden');
    } catch (error) {
      showToast('Failed to generate spreadsheet', 'error');
    }
    
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Generate Spreadsheet
    `;
  });
  
  backBtn.addEventListener('click', () => {
    reviewStep.classList.add('hidden');
    promptStep.classList.remove('hidden');
    sheetContent = null;
  });
  
  createBtn.addEventListener('click', async () => {
    if (!sheetContent) {
      showToast('No spreadsheet to create', 'error');
      return;
    }
    
    createBtn.disabled = true;
    createBtn.innerHTML = '<div class="spinner"></div><span>Creating spreadsheet...</span>';
    
    try {
      const response = await axios.post('/api/actions/create-google-sheet', {
        ideaId: currentIdea?.id,
        sheetContent: sheetContent
      });
      
      showToast(`Created spreadsheet with ${response.data.sheetCount} sheet(s)!`, 'success');
      
      // Open the sheet in a new tab
      if (response.data.spreadsheetUrl) {
        window.open(response.data.spreadsheetUrl, '_blank');
      }
      
      closeModal();
      sheetContent = null;
      await loadActionHistory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create spreadsheet', 'error');
    }
    
    createBtn.disabled = false;
    createBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Create Google Sheet
    `;
  });
}

// ============== CONTENT HANDLERS ==============
function setupContentHandlers() {
  const form = document.getElementById('contentForm');
  const outputSection = document.getElementById('contentOutput');
  const contentResult = document.getElementById('contentResult');
  const copyBtn = document.getElementById('copyContentBtn');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentIdea) {
      showToast('No idea selected', 'error');
      return;
    }
    
    const contentType = document.getElementById('contentType').value;
    const tone = document.getElementById('contentTone').value;
    const points = document.getElementById('contentPoints').value;
    const submitBtn = document.getElementById('contentSubmitBtn');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner"></div><span>Generating...</span>';
    
    try {
      const response = await axios.post('/api/actions/generate-content', {
        ideaId: currentIdea.id,
        idea: currentIdea.text,
        contentType,
        tone,
        points
      });
      
      contentResult.textContent = response.data.content;
      outputSection.classList.remove('hidden');
      
      await axios.post('/api/actions/log', {
        ideaId: currentIdea.id,
        type: 'content',
        title: `${contentType}: ${currentIdea.text.substring(0, 30)}...`,
        data: { contentType, content: response.data.content }
      });
      
      await loadActionHistory();
    } catch (error) {
      showToast('Failed to generate content', 'error');
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Content';
  });
  
  copyBtn?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(contentResult.textContent);
    showToast('Content copied to clipboard!', 'success');
  });
}

// Toast notifications
function showToast(message, type = 'success') {
  toast.className = `toast ${type}`;
  toast.querySelector('.toast-message').textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize on page load
init();
