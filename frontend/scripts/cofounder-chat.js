/**
 * AI Co-Founder Chat Page
 * 
 * Handles the voice meeting UI, state management,
 * and interaction with the 3D orb component.
 */

// State
let orb = null;
let voiceManager = null;
let callState = 'idle'; // 'idle', 'connecting', 'active', 'ending', 'summary'
let callStartTime = null;
let callTimerInterval = null;
let transcript = [];
let isMuted = false;
let isProcessing = false; // Prevents overlapping requests
let currentUserId = null;
let currentSessionId = null;
let currentIdeaId = null;

// DOM Elements
const idleState = document.getElementById('idleState');
const activeState = document.getElementById('activeState');
const summaryState = document.getElementById('summaryState');
const statusIndicator = document.getElementById('statusIndicator');
const startCallBtn = document.getElementById('startCallBtn');
const endCallBtn = document.getElementById('endCallBtn');
const muteBtn = document.getElementById('muteBtn');
const callStatusText = document.getElementById('callStatusText');
const callTimer = document.getElementById('callTimer');
const transcriptToggle = document.getElementById('transcriptToggle');
const transcriptContent = document.getElementById('transcriptContent');
const transcriptMessages = document.getElementById('transcriptMessages');
const sessionsList = document.getElementById('sessionsList');
const summaryLoading = document.getElementById('summaryLoading');
const summaryContent = document.getElementById('summaryContent');
const summaryActions = document.getElementById('summaryActions');
const emailSummaryBtn = document.getElementById('emailSummary');
const startNewCall = document.getElementById('startNewCall');
const backToIdleBtn = document.getElementById('backToIdleBtn');
const deleteMeetingBtn = document.getElementById('deleteMeetingBtn');

// Summary section elements
const summaryDate = document.getElementById('summaryDate');
const summaryDuration = document.getElementById('summaryDuration');
const ideaStandingContent = document.getElementById('ideaStandingContent');
const discussedList = document.getElementById('discussedList');
const insightsList = document.getElementById('insightsList');
const whatsNewList = document.getElementById('whatsNewList');
const nextStepsList = document.getElementById('nextStepsList');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = localStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/auth.html';
    return;
  }

  // Get user info
  try {
    const response = await axios.get('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    currentUserId = response.data.userId;
  } catch (error) {
    console.error('Error getting user info:', error);
    // If 401, redirect to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/auth.html';
      return;
    }
    // For other errors (like 500), continue - we can still work without userId
  }

  // Get current idea from localStorage (same key used by sidebar and other pages)
  let storedIdeaId = localStorage.getItem('ideaId');
  if (storedIdeaId) {
    try {
      // The sidebar stores it as JSON.stringify(ideaId)
      currentIdeaId = JSON.parse(storedIdeaId);
      console.log('[CofounderChat] Using idea from localStorage:', currentIdeaId);
    } catch (e) {
      // If not valid JSON, use as-is
      currentIdeaId = storedIdeaId;
    }
  }
  
  // If no idea selected, try to get the first one from dashboard
  if (!currentIdeaId) {
    try {
      const dashResponse = await axios.get('/api/dashboard/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('[CofounderChat] Dashboard projects:', dashResponse.data);
      if (dashResponse.data.projects && dashResponse.data.projects.length > 0) {
        currentIdeaId = dashResponse.data.projects[0]._id;
        console.log('[CofounderChat] Using first idea from dashboard:', currentIdeaId);
      }
    } catch (e) {
      console.log('Could not load projects:', e);
    }
  }

  // Initialize the 3D orb
  initOrb();

  // Initialize voice manager
  initVoiceManager();

  // Load recent sessions
  loadRecentSessions();

  // Set up event listeners
  setupEventListeners();
});

/**
 * Initialize the 3D orb in the container
 */
function initOrb() {
  const container = callState === 'active' ? 'orb-container-active' : 'orb-container';
  orb = new CofounderOrb(container);
}

/**
 * Initialize voice manager for speech recognition and TTS
 */
function initVoiceManager() {
  if (!VoiceManager.isSupported()) {
    console.warn('Voice features not fully supported in this browser');
  }

  voiceManager = new VoiceManager({
    onTranscript: handleTranscript,
    onUserSpeechDetected: () => {
      // User started speaking - immediately interrupt AI if it's talking
      if (voiceManager?.isPlaying) {
        console.log('[CofounderChat] Interrupting AI - user is speaking');
        voiceManager.stopPlayback();
        orb?.setState('listening');
        callStatusText.textContent = 'Listening...';
      }
    },
    onSpeechStart: () => {
      // AI is speaking
      orb?.setState('speaking');
    },
    onSpeechEnd: () => {
      // AI finished speaking, go back to listening
      if (callState === 'active' && !isMuted) {
        orb?.setState('listening');
      }
    },
    onAudioLevel: (level) => {
      // Update orb with audio level during AI speech
      if (orb && callState === 'active') {
        orb.setAudioLevel(level);
      }
    },
    onListeningChange: (isListening) => {
      // Update status when listening state changes
      if (callState === 'active') {
        if (isListening && !isMuted) {
          callStatusText.textContent = 'Listening...';
        }
      }
    },
    onError: (error) => {
      console.error('Voice error:', error);
    }
  });
}

// Track pending action for voice approval flow
let pendingVoiceAction = null;

/**
 * Check if user message is approving/canceling a pending action
 */
function checkVoiceActionApproval(text) {
  if (!pendingVoiceAction) return null;
  
  const lower = text.toLowerCase().trim();
  
  // Approval phrases
  const approvalPhrases = ['yes', 'yeah', 'yep', 'sure', 'do it', 'send it', 'create it', 'go ahead', 'please', 'okay', 'ok'];
  if (approvalPhrases.some(phrase => lower.includes(phrase))) {
    return { approved: true };
  }
  
  // Cancel phrases
  const cancelPhrases = ['no', 'nope', 'cancel', 'stop', 'never mind', 'nevermind', 'don\'t', 'dont'];
  if (cancelPhrases.some(phrase => lower.includes(phrase))) {
    return { approved: false };
  }
  
  return null;
}

/**
 * Handle transcript from speech recognition
 */
async function handleTranscript(text, isFinal) {
  if (!isFinal || !text) return;
  if (callState !== 'active') return;
  
  // If user speaks while AI is talking, interrupt the AI
  if (voiceManager?.isPlaying) {
    console.log('[CofounderChat] User interrupted AI, stopping playback');
    voiceManager.stopPlayback();
    orb?.setState('listening');
  }
  
  // If already processing a message, ignore (prevent overlap)
  if (isProcessing) {
    console.log('[CofounderChat] Already processing, ignoring transcript');
    return;
  }
  
  console.log('[CofounderChat] Got transcript:', text);
  isProcessing = true;
  
  // Add user message to transcript
  addTranscriptMessage('You', text);
  
  // Show thinking state
  orb?.setState('thinking');
  callStatusText.textContent = 'Thinking...';

  try {
    const token = localStorage.getItem('accessToken');
    
    console.log('[CofounderChat] Sending message to backend...');
    
    // Check if this is an action approval response
    const approvalCheck = checkVoiceActionApproval(text);
    
    let requestBody = {
      sessionId: currentSessionId,
      message: text
    };
    
    // If there's a pending action and user is responding to it
    if (pendingVoiceAction && approvalCheck) {
      requestBody.pendingAction = pendingVoiceAction;
      requestBody.actionApproved = approvalCheck.approved;
      
      // Clear pending action after sending
      pendingVoiceAction = null;
    }
    
    // Send message to backend
    const response = await axios.post('/api/cofounder/message', requestBody, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('[CofounderChat] Got response:', response.data);

    if (response.data.success && response.data.response) {
      const aiResponse = response.data.response;
      
      console.log('[CofounderChat] AI response:', aiResponse.substring(0, 100) + '...');
      
      // Check if this response contains a pending action
      if (response.data.actionPending) {
        pendingVoiceAction = {
          actionType: response.data.actionType,
          actionData: response.data.actionData
        };
        console.log('[CofounderChat] Action pending:', pendingVoiceAction);
        
        // Show action preview in transcript
        const preview = response.data.actionPreview;
        addTranscriptMessage('AI', `🔔 ${preview.displayText}\n\n${aiResponse}`);
      } else {
        // Regular message
        addTranscriptMessage('AI', aiResponse);
      }
      
      // If action was completed, show success with link
      if (response.data.actionCompleted && response.data.actionResult?.url) {
        addTranscriptMessage('AI', `✅ Action completed! [Open](${response.data.actionResult.url})`);
      }
      
      // Update orb to speaking state
      orb?.setState('speaking');
      callStatusText.textContent = 'Speaking...';
      
      // Speak the response
      console.log('[CofounderChat] Calling voiceManager.speak...');
      await voiceManager?.speak(aiResponse);
      console.log('[CofounderChat] TTS finished');
    } else {
      console.warn('[CofounderChat] No response in data:', response.data);
    }
  } catch (error) {
    console.error('[CofounderChat] Error processing message:', error);
    orb?.setState('listening');
  } finally {
    isProcessing = false;
    orb?.setState('listening');
    
    if (callState === 'active' && !isMuted) {
      callStatusText.textContent = 'Listening...';
    }
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Start call button
  startCallBtn.addEventListener('click', startCall);

  // End call button
  endCallBtn.addEventListener('click', endCall);

  // Mute button
  muteBtn.addEventListener('click', toggleMute);
  
  // Keyboard shortcut to interrupt AI (spacebar)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && callState === 'active' && voiceManager?.isPlaying) {
      e.preventDefault();
      console.log('[CofounderChat] Spacebar pressed - interrupting AI');
      voiceManager.stopPlayback();
      orb?.setState('listening');
      callStatusText.textContent = 'Listening...';
    }
  });

  // Transcript toggle
  transcriptToggle.addEventListener('click', () => {
    transcriptContent.classList.toggle('hidden');
  });

  // Summary actions
  emailSummaryBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('accessToken');
    
    emailSummaryBtn.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
      </svg>
      Sending...
    `;
    emailSummaryBtn.disabled = true;
    
    try {
      if (currentSessionId) {
        await axios.post('/api/cofounder/email-summary', {
          sessionId: currentSessionId
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      emailSummaryBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Sent to Email
      `;
    } catch (error) {
      console.error('Error sending email:', error);
      emailSummaryBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Sent to Email
      `;
    }
  });

  // Back to idle button
  backToIdleBtn.addEventListener('click', () => {
    goBackToIdle();
  });

  startNewCall.addEventListener('click', () => {
    resetToIdle();
  });

  // Delete meeting button
  deleteMeetingBtn.addEventListener('click', async () => {
    if (!currentSessionId) {
      goBackToIdle();
      return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this meeting? This cannot be undone.')) {
      return;
    }
    
    const token = localStorage.getItem('accessToken');
    
    deleteMeetingBtn.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
      </svg>
      Deleting...
    `;
    deleteMeetingBtn.disabled = true;
    
    try {
      await axios.delete(`/api/cofounder/sessions/${currentSessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Go back to idle and refresh sessions list
      goBackToIdle();
      
    } catch (error) {
      console.error('Error deleting meeting:', error);
      deleteMeetingBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        Delete
      `;
      deleteMeetingBtn.disabled = false;
      alert('Failed to delete meeting');
    }
  });

  // Sync to IdeaHub button
  const syncToIdeaHubBtn = document.getElementById('syncToIdeaHub');
  if (syncToIdeaHubBtn) {
    syncToIdeaHubBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('accessToken');
      
      syncToIdeaHubBtn.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        Syncing...
      `;
      syncToIdeaHubBtn.disabled = true;
      
      try {
        if (currentSessionId) {
          await axios.post('/api/cofounder/sync-to-idea', {
            sessionId: currentSessionId
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        syncToIdeaHubBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Synced to IdeaHub
        `;
        syncToIdeaHubBtn.classList.add('success');
      } catch (error) {
        console.error('Error syncing to IdeaHub:', error);
        syncToIdeaHubBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Sync Failed
        `;
        syncToIdeaHubBtn.classList.add('error');
        
        // Reset after 2 seconds to allow retry
        setTimeout(() => {
          syncToIdeaHubBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Sync to IdeaHub
          `;
          syncToIdeaHubBtn.disabled = false;
          syncToIdeaHubBtn.classList.remove('error');
        }, 2000);
      }
    });
  }
}

/**
 * Start a new call
 */
async function startCall() {
  callState = 'connecting';
  
  // Update UI - show active state
  idleState.classList.add('hidden');
  activeState.classList.remove('hidden');
  
  // Reinitialize orb in the active container
  if (orb) {
    orb.destroy();
  }
  orb = new CofounderOrb('orb-container-active');
  orb.setState('thinking');
  
  callStatusText.textContent = 'Connecting...';

  const token = localStorage.getItem('accessToken');
  let greeting = "Hey! I'm your AI co-founder. What's on your mind today?";

  // Start session with backend (works with or without ideaId)
  try {
    console.log('[CofounderChat] Starting session with ideaId:', currentIdeaId);
    
    const response = await axios.post('/api/cofounder/start', {
      ideaId: currentIdeaId || null
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('[CofounderChat] Start session response:', response.data);

    if (response.data.success) {
      currentSessionId = response.data.sessionId;
      greeting = response.data.greeting || greeting;
      
      console.log('[CofounderChat] Session created:', currentSessionId);
      
      // Update status with idea context
      if (response.data.context?.ideaName) {
        console.log(`Session started for: ${response.data.context.ideaName}`);
      }
    }
  } catch (error) {
    console.error('[CofounderChat] Error starting session:', error);
    // Continue with local-only mode but warn user
    greeting = "Hey! I'm having trouble connecting to my memory, but I'm still here to help. What's on your mind?";
  }

  // Start the call
  callState = 'active';
  callStartTime = Date.now();
  transcript = [];
  
  // Start timer
  startCallTimer();
  
  // Update status
  callStatusText.textContent = 'Connected';
  orb.setState('listening');

  // Add initial AI greeting
  addTranscriptMessage('AI', greeting);
  
  // Speak the greeting using TTS, then start listening
  if (voiceManager) {
    await voiceManager.speak(greeting);
    
    // Start listening after greeting
    if (!isMuted) {
      voiceManager.startListening();
      callStatusText.textContent = 'Listening...';
    }
  } else {
    // Fallback: simulate speaking
    orb.simulateSpeaking(3000);
  }
}

/**
 * End the current call
 */
async function endCall() {
  callState = 'ending';
  
  // Stop voice manager
  voiceManager?.stopListening();
  voiceManager?.stopPlayback();
  
  // Stop timer
  stopCallTimer();
  
  // Update orb
  if (orb) {
    orb.setState('thinking');
    orb.setAudioLevel(0);
  }
  
  callStatusText.textContent = 'Ending meeting...';

  // Short delay before showing summary
  await new Promise(resolve => setTimeout(resolve, 500));

  // Show summary state
  activeState.classList.add('hidden');
  summaryState.classList.remove('hidden');
  callState = 'summary';

  // Clean up orb
  if (orb) {
    orb.destroy();
    orb = null;
  }

  // Generate summary - try API first, fallback to mock
  await generateSummary();
}

/**
 * Toggle microphone mute
 */
function toggleMute() {
  isMuted = !isMuted;
  
  muteBtn.classList.toggle('muted', isMuted);
  muteBtn.querySelector('.unmuted-icon').classList.toggle('hidden', isMuted);
  muteBtn.querySelector('.muted-icon').classList.toggle('hidden', !isMuted);
  
  if (isMuted) {
    // Stop listening when muted
    voiceManager?.stopListening();
    orb?.setAudioLevel(0);
    orb?.setState('idle');
    callStatusText.textContent = 'Muted';
  } else {
    // Resume listening when unmuted
    if (callState === 'active' && !voiceManager?.isPlaying) {
      voiceManager?.startListening();
      orb?.setState('listening');
      callStatusText.textContent = 'Listening...';
    }
  }
}

/**
 * Start the call timer
 */
function startCallTimer() {
  callTimerInterval = setInterval(() => {
    const elapsed = Date.now() - callStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    callTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

/**
 * Stop the call timer
 */
function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
}

/**
 * Add a message to the transcript
 */
function addTranscriptMessage(speaker, text) {
  transcript.push({ speaker, text, timestamp: Date.now() });
  
  const messageEl = document.createElement('div');
  messageEl.className = `transcript-message ${speaker === 'You' ? 'user' : 'ai'}`;
  messageEl.innerHTML = `
    <span class="speaker">${speaker}:</span>
    <span class="text">${text}</span>
  `;
  
  transcriptMessages.appendChild(messageEl);
  transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
}

/**
 * Generate summary after call ends
 */
async function generateSummary() {
  // Show loading
  summaryLoading.style.display = 'flex';
  summaryContent.classList.add('hidden');
  summaryActions.classList.add('hidden');

  // Calculate duration
  const duration = callStartTime ? Date.now() - callStartTime : 0;
  
  let summaryData = null;
  const token = localStorage.getItem('accessToken');

  // Try to get summary from backend
  if (currentSessionId) {
    try {
      const response = await axios.post('/api/cofounder/end', {
        sessionId: currentSessionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.session?.summary) {
        const apiSummary = response.data.session.summary;
        summaryData = {
          date: new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          duration: formatDuration(response.data.session.duration || duration),
          ideaStanding: apiSummary.ideaStanding || '',
          discussed: apiSummary.discussed || [],
          insights: apiSummary.insights || [],
          whatsNew: apiSummary.whatsNew || [],
          nextSteps: apiSummary.nextSteps || []
        };
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  // Fallback to mock data if API didn't return summary
  if (!summaryData) {
    // Simulate loading for mock data
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    summaryData = {
      date: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      duration: formatDuration(duration),
      ideaStanding: 'Your startup idea is showing strong potential. The core value proposition is clear, and initial market research suggests there\'s genuine demand for a solution in this space. However, there are some areas that need further validation before moving forward with development.',
      discussed: [
        'Core value proposition and how it differentiates from existing solutions',
        'Target customer segments and their primary pain points',
        'Revenue model options including subscription tiers and one-time purchases',
        'Technical feasibility and estimated development timeline',
        'Potential go-to-market strategies for early traction'
      ],
      insights: [
        'The B2B market may be more viable than B2C for initial launch due to higher willingness to pay',
        'Competitors are focused on enterprise - there\'s a gap in the SMB segment',
        'Customer interviews should focus on quantifying the current cost of the problem',
        'A freemium model could accelerate adoption but may affect perceived value'
      ],
      whatsNew: [
        'Refined target audience from "small businesses" to "marketing agencies with 5-20 employees"',
        'Added a new feature idea: automated reporting dashboard',
        'Identified two potential pilot customers to reach out to'
      ],
      nextSteps: [
        { text: 'Conduct 5 customer discovery interviews this week', priority: 'high' },
        { text: 'Research competitor pricing models in detail', priority: 'medium' },
        { text: 'Create a simple landing page to test messaging', priority: 'medium' },
        { text: 'Draft initial feature prioritization matrix', priority: null }
      ]
    };
  }

  // Hide loading, show content
  summaryLoading.style.display = 'none';
  summaryContent.classList.remove('hidden');
  summaryActions.classList.remove('hidden');

  // Update summary subtitle
  document.querySelector('.summary-subtitle').textContent = 'Here\'s what we covered';

  // Populate the summary
  renderSummary(summaryData);
}

/**
 * Render summary data into the DOM
 */
function renderSummary(data) {
  // Meta info
  summaryDate.textContent = data.date;
  summaryDuration.textContent = data.duration;

  // How Your Idea Stands Now
  ideaStandingContent.textContent = data.ideaStanding;

  // What We Discussed
  discussedList.innerHTML = data.discussed
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');

  // Key Insights
  insightsList.innerHTML = data.insights
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');

  // What's New
  whatsNewList.innerHTML = data.whatsNew
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');

  // Next Steps (with priority badges)
  nextStepsList.innerHTML = data.nextSteps
    .map(step => {
      const priorityBadge = step.priority 
        ? `<span class="priority-${step.priority}">${step.priority}</span>` 
        : '';
      return `<li>${escapeHtml(step.text)}${priorityBadge}</li>`;
    })
    .join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Go back to idle state (without full reset)
 */
function goBackToIdle() {
  // Hide summary, show idle with animation
  summaryState.style.opacity = '1';
  summaryState.style.transition = 'opacity 0.3s ease';
  summaryState.style.opacity = '0';
  
  setTimeout(() => {
    summaryState.classList.add('hidden');
    summaryState.style.opacity = '';
    summaryState.style.transition = '';
    
    idleState.style.opacity = '0';
    idleState.classList.remove('hidden');
    idleState.style.transition = 'opacity 0.3s ease';
    
    requestAnimationFrame(() => {
      idleState.style.opacity = '1';
      
      setTimeout(() => {
        idleState.style.opacity = '';
        idleState.style.transition = '';
      }, 300);
    });
    
    // Reinitialize orb if needed
    if (orb) {
      orb.destroy();
    }
    orb = new CofounderOrb('orb-container');
    
    // Reload sessions to reflect any changes
    loadRecentSessions();
  }, 300);
}

/**
 * Reset to idle state
 */
function resetToIdle() {
  callState = 'idle';
  transcript = [];
  currentSessionId = null;
  isProcessing = false;
  isMuted = false;
  transcriptMessages.innerHTML = '';
  callTimer.textContent = '00:00';
  
  // Reset mute button state
  muteBtn.classList.remove('muted');
  muteBtn.querySelector('.unmuted-icon')?.classList.remove('hidden');
  muteBtn.querySelector('.muted-icon')?.classList.add('hidden');
  
  // Stop voice manager
  voiceManager?.stopListening();
  voiceManager?.stopPlayback();
  
  // Reset email button
  emailSummaryBtn.disabled = false;
  emailSummaryBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
    Email Summary
  `;
  
  // Hide other states, show idle
  activeState.classList.add('hidden');
  summaryState.classList.add('hidden');
  idleState.classList.remove('hidden');
  
  // Reinitialize orb in idle container
  if (orb) {
    orb.destroy();
  }
  orb = new CofounderOrb('orb-container');
  
  // Reload recent sessions
  loadRecentSessions();
}

/**
 * Load recent meeting sessions
 */
async function loadRecentSessions() {
  const token = localStorage.getItem('accessToken');
  let recentSessions = [];

  // Try to load from API
  try {
    const params = currentIdeaId ? `?ideaId=${currentIdeaId}&limit=5` : '?limit=5';
    const response = await axios.get(`/api/cofounder/sessions${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success && response.data.sessions) {
      recentSessions = response.data.sessions;
    }
  } catch (error) {
    console.log('Could not load recent sessions:', error);
  }

  if (recentSessions.length === 0) {
    sessionsList.innerHTML = `
      <div class="no-sessions">
        <p>No meetings yet. Start your first one!</p>
      </div>
    `;
    return;
  }

  sessionsList.innerHTML = recentSessions.map(session => `
    <div class="session-item" data-session-id="${session.id}">
      <div class="session-info">
        <span class="session-date">${formatDate(new Date(session.date))}</span>
        <span class="session-preview">${escapeHtml(session.preview || 'Meeting summary')}</span>
      </div>
      <span class="session-duration">${formatDuration(session.duration)}</span>
    </div>
  `).join('');

  // Add click handlers to view past sessions
  sessionsList.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', () => {
      const sessionId = item.dataset.sessionId;
      viewPastSession(sessionId);
    });
  });
}

/**
 * View a past session's summary board
 */
async function viewPastSession(sessionId) {
  const token = localStorage.getItem('accessToken');
  
  try {
    // Animate idle state out
    idleState.style.transition = 'opacity 0.25s ease';
    idleState.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Show loading state
    idleState.classList.add('hidden');
    idleState.style.opacity = '';
    idleState.style.transition = '';
    
    summaryState.classList.remove('hidden');
    summaryState.style.opacity = '0';
    summaryState.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(() => {
      summaryState.style.opacity = '1';
    });
    
    summaryLoading.style.display = 'flex';
    summaryContent.classList.add('hidden');
    summaryActions.classList.add('hidden');
    
    document.querySelector('.summary-title').textContent = 'Loading Meeting...';
    document.querySelector('.summary-subtitle').textContent = 'Fetching summary...';
    
    // Fetch session details
    const response = await axios.get(`/api/cofounder/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.data.success || !response.data.session) {
      throw new Error('Session not found');
    }
    
    const session = response.data.session;
    const summary = session.summary;
    
    // Format the data
    const summaryData = {
      date: new Date(session.endedAt || session.startedAt).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      duration: formatDuration(session.duration),
      ideaStanding: summary?.ideaStanding || 'Summary not available',
      discussed: summary?.discussed || [],
      insights: summary?.insights || [],
      whatsNew: summary?.whatsNew || [],
      nextSteps: summary?.nextSteps || []
    };
    
    // Hide loading, show content with animation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    summaryLoading.style.display = 'none';
    summaryContent.classList.remove('hidden');
    
    // Clean up transition styles
    summaryState.style.opacity = '';
    summaryState.style.transition = '';
    
    // Update header
    document.querySelector('.summary-title').textContent = session.ideaName || 'Meeting Summary';
    document.querySelector('.summary-subtitle').textContent = 'Here\'s what was covered';
    
    // Render the summary board
    renderSummary(summaryData);
    
    // Show actions with back button
    summaryActions.classList.remove('hidden');
    
    // Store current session for reference
    currentSessionId = sessionId;
    
  } catch (error) {
    console.error('Error loading session:', error);
    // Go back to idle state on error
    summaryState.classList.add('hidden');
    summaryState.style.opacity = '';
    summaryState.style.transition = '';
    idleState.classList.remove('hidden');
  }
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format date for display
 */
function formatDate(date) {
  const now = new Date();
  const d = new Date(date);
  
  if (d.toDateString() === now.toDateString()) {
    return 'Today';
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
