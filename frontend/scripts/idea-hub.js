// ============================================
// IDEA HUB PAGE SCRIPT
// ============================================

axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;

// State
let currentIdea = null;
let ideaId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  ideaId = JSON.parse(localStorage.getItem('ideaId'));
  
  if (!ideaId) {
    showToast('No idea selected. Please select an idea first.', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 2000);
    return;
  }
  
  await loadIdea();
  setupEventListeners();
});

// ============================================
// LOAD IDEA (Simple - just get from DB)
// ============================================

async function loadIdea() {
  try {
    const response = await axios.get(`/api/save/idea/${ideaId}`);
    currentIdea = response.data.idea;
    
    if (!currentIdea) {
      document.getElementById('ideaContent').innerHTML = `
        <div class="empty-state">
          <p>No idea found. Please create an idea first.</p>
          <a href="/idea-page.html" class="btn btn-primary" style="margin-top: 16px;">Create New Idea</a>
        </div>
      `;
      return;
    }
    
    renderIdea();
    renderHistory();
  } catch (error) {
    console.error('Error loading idea:', error);
    document.getElementById('ideaContent').textContent = 'Failed to load idea. Please try again.';
    showToast('Failed to load idea', 'error');
  }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderIdea() {
  if (!currentIdea) return;
  
  // Update idea content
  document.getElementById('ideaContent').textContent = currentIdea.idea || 'No idea content yet.';
  
  // Update meta info
  document.getElementById('ideaName').textContent = currentIdea.ideaName || 'Untitled Idea';
  
  // Format last synced date
  const lastSyncedEl = document.getElementById('lastSynced');
  if (currentIdea.lastSyncedAt) {
    const date = new Date(currentIdea.lastSyncedAt);
    lastSyncedEl.textContent = formatRelativeTime(date);
  } else {
    lastSyncedEl.textContent = 'Never synced';
  }
  
  // Update history count
  const count = currentIdea.ideaHistory?.length || 0;
  document.getElementById('historyCount').textContent = `${count} version${count !== 1 ? 's' : ''}`;
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  
  if (!currentIdea?.ideaHistory || currentIdea.ideaHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No version history yet</p>
        <span style="font-size: 0.85rem">Updates will appear here as you make changes</span>
      </div>
    `;
    return;
  }
  
  // Sort history by date (newest first)
  const sortedHistory = [...currentIdea.ideaHistory].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  
  historyList.innerHTML = sortedHistory.map(item => `
    <div class="history-item" data-history-id="${item._id}">
      <div class="history-icon ${item.updateSource || 'manual'}">
        ${getSourceIcon(item.updateSource)}
      </div>
      <div class="history-content">
        <div class="history-date">${formatDate(item.updatedAt)}</div>
        <div class="history-summary">${item.updateSummary || getSourceLabel(item.updateSource)}</div>
        <div class="history-preview">${truncateText(item.idea, 100)}</div>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const historyId = item.dataset.historyId;
      const historyItem = currentIdea.ideaHistory.find(h => h._id === historyId);
      if (historyItem) {
        showHistoryDetail(historyItem);
      }
    });
  });
}

// ============================================
// SYNC WITH AI (Based on scoreboard renew pattern)
// ============================================

async function syncWithAI() {
  const syncBtn = document.getElementById('syncBtn');
  
  try {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<span class="spinner"></span> Analyzing...`;
    
    // 1. Get chat logs (same as scoreboard)
    const chatLogs = await getChatLogs(ideaId);
    
    // 2. Get market research if available
    let marketData = '';
    try {
      const marketResp = await axios.get(`/api/save/saveMarket/${ideaId}`);
      if (marketResp.data?.marketResponse?.marketResponse) {
        marketData = marketResp.data.marketResponse.marketResponse;
      }
    } catch (e) {
      console.log('No market data available');
    }
    
    // 3. Get most recent cofounder meeting summary
    let meetingSummary = '';
    try {
      const meetingResp = await axios.get(`/api/cofounder/sessions?ideaId=${ideaId}&limit=1`);
      if (meetingResp.data?.success && meetingResp.data.sessions?.length > 0) {
        const session = meetingResp.data.sessions[0];
        // Fetch full session details to get summary
        const fullSession = await axios.get(`/api/cofounder/sessions/${session.id}`);
        if (fullSession.data?.success && fullSession.data.session?.summary) {
          const summary = fullSession.data.session.summary;
          meetingSummary = `\n\nMOST RECENT CO-FOUNDER MEETING:\n`;
          if (summary.ideaStanding) meetingSummary += `How idea stands: ${summary.ideaStanding}\n`;
          if (summary.discussed?.length) meetingSummary += `Discussed: ${summary.discussed.join(', ')}\n`;
          if (summary.insights?.length) meetingSummary += `Key insights: ${summary.insights.join(', ')}\n`;
          if (summary.whatsNew?.length) meetingSummary += `What's new: ${summary.whatsNew.join(', ')}\n`;
          if (summary.nextSteps?.length) meetingSummary += `Next steps: ${summary.nextSteps.map(s => s.text || s).join(', ')}\n`;
        }
      }
    } catch (e) {
      console.log('No cofounder meeting data available');
    }
    
    // 4. Call AI to update idea
    const oldIdea = currentIdea.idea;
    
    const { data } = await axios.post('/api/idea-hub/sync', {
      ideaId,
      oldIdea,
      chatLogs: chatLogs + meetingSummary,
      marketData
    });
    
    if (data.noChanges) {
      showToast('Your idea is already up to date!', 'success');
      return;
    }
    
    const newIdea = data.newIdea;
    const changeSummary = data.changeSummary || 'AI updated your idea based on recent conversations';
    
    // 4. Save directly without confirmation
    if (!currentIdea.ideaHistory) {
      currentIdea.ideaHistory = [];
    }
    
    currentIdea.ideaHistory.push({
      idea: currentIdea.idea,
      updatedAt: new Date().toISOString(),
      updateSource: 'ai_sync',
      updateSummary: changeSummary
    });
    
    await axios.patch(`/api/save/idea/${ideaId}`, {
      idea: newIdea,
      ideaHistory: currentIdea.ideaHistory,
      lastSyncedAt: new Date().toISOString()
    });
    
    await loadIdea();
    showToast('Idea synced successfully!', 'success');
    
  } catch (error) {
    console.error('Error syncing with AI:', error);
    showToast(error.response?.data?.error || 'Failed to sync with AI', 'error');
  } finally {
    syncBtn.disabled = false;
    syncBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Sync with AI
    `;
  }
}

async function getChatLogs(ideaId) {
  try {
    const resp = await axios.get(`/api/save/getAllChats/${ideaId}`);
    const chatLogs = Array.isArray(resp.data?.savedChat) ? resp.data.savedChat : [];
    let listOfChats = '';
    chatLogs.forEach((chatLog) => {
      listOfChats += `User: ${chatLog.userMessage}\n`;
      listOfChats += `AI: ${chatLog.AiResponse}\n\n`;
    });
    return listOfChats;
  } catch (error) {
    console.log('No chat logs found');
    return '';
  }
}

function showSyncPreview(oldIdea, newIdea, changeSummary) {
  document.getElementById('currentIdeaPreview').textContent = oldIdea || 'No previous idea';
  document.getElementById('newIdeaPreview').textContent = newIdea;
  document.getElementById('changesSummary').textContent = changeSummary;
  
  // Store the new idea for confirmation
  document.getElementById('syncModal').dataset.newIdea = newIdea;
  document.getElementById('syncModal').dataset.changeSummary = changeSummary;
  
  document.getElementById('syncModal').classList.remove('hidden');
}

async function confirmSync() {
  const syncModal = document.getElementById('syncModal');
  const newIdea = syncModal.dataset.newIdea;
  const changeSummary = syncModal.dataset.changeSummary;
  
  try {
    // Save old idea to history
    if (!currentIdea.ideaHistory) {
      currentIdea.ideaHistory = [];
    }
    
    currentIdea.ideaHistory.push({
      idea: currentIdea.idea,
      updatedAt: new Date().toISOString(),
      updateSource: 'ai_sync',
      updateSummary: changeSummary
    });
    
    // Update current idea
    await axios.patch(`/api/save/idea/${ideaId}`, {
      idea: newIdea,
      ideaHistory: currentIdea.ideaHistory,
      lastSyncedAt: new Date().toISOString()
    });
    
    // Reload to get fresh data
    await loadIdea();
    
    closeModal(syncModal);
    showToast('Idea synced successfully!', 'success');
  } catch (error) {
    console.error('Error confirming sync:', error);
    showToast('Failed to save synced idea', 'error');
  }
}

// ============================================
// MANUAL EDIT
// ============================================

function openEditModal() {
  const textarea = document.getElementById('editIdeaTextarea');
  const summaryInput = document.getElementById('editSummaryInput');
  
  textarea.value = currentIdea?.idea || '';
  summaryInput.value = '';
  document.getElementById('charCount').textContent = `${textarea.value.length} characters`;
  
  document.getElementById('editModal').classList.remove('hidden');
  textarea.focus();
}

async function saveEdit() {
  const textarea = document.getElementById('editIdeaTextarea');
  const summaryInput = document.getElementById('editSummaryInput');
  
  const newIdea = textarea.value.trim();
  const summary = summaryInput.value.trim() || 'Manual update';
  
  if (!newIdea) {
    showToast('Idea cannot be empty', 'error');
    return;
  }
  
  try {
    // Save old idea to history
    if (!currentIdea.ideaHistory) {
      currentIdea.ideaHistory = [];
    }
    
    currentIdea.ideaHistory.push({
      idea: currentIdea.idea,
      updatedAt: new Date().toISOString(),
      updateSource: 'manual',
      updateSummary: summary
    });
    
    // Update idea
    await axios.patch(`/api/save/idea/${ideaId}`, {
      idea: newIdea,
      ideaHistory: currentIdea.ideaHistory
    });
    
    await loadIdea();
    closeModal(document.getElementById('editModal'));
    showToast('Idea updated successfully!', 'success');
  } catch (error) {
    console.error('Error saving edit:', error);
    showToast('Failed to update idea', 'error');
  }
}

// ============================================
// RESTORE FROM HISTORY
// ============================================

function showHistoryDetail(historyItem) {
  document.getElementById('historyDetailDate').textContent = formatDate(historyItem.updatedAt);
  document.getElementById('historyDetailSource').textContent = getSourceLabel(historyItem.updateSource);
  document.getElementById('historyDetailSummary').textContent = historyItem.updateSummary || 'No summary available';
  document.getElementById('historyDetailContent').textContent = historyItem.idea;
  
  // Store the history item for restore
  document.getElementById('restoreBtn').dataset.historyIdea = historyItem.idea;
  
  document.getElementById('historyModal').classList.remove('hidden');
}

async function restoreFromHistory() {
  const restoreBtn = document.getElementById('restoreBtn');
  const ideaToRestore = restoreBtn.dataset.historyIdea;
  
  if (!ideaToRestore) {
    showToast('No idea to restore', 'error');
    return;
  }
  
  try {
    // Save current idea to history first
    if (!currentIdea.ideaHistory) {
      currentIdea.ideaHistory = [];
    }
    
    currentIdea.ideaHistory.push({
      idea: currentIdea.idea,
      updatedAt: new Date().toISOString(),
      updateSource: 'manual',
      updateSummary: 'Before restoring older version'
    });
    
    // Restore the old version
    await axios.patch(`/api/save/idea/${ideaId}`, {
      idea: ideaToRestore,
      ideaHistory: currentIdea.ideaHistory
    });
    
    await loadIdea();
    closeModal(document.getElementById('historyModal'));
    showToast('Version restored successfully!', 'success');
  } catch (error) {
    console.error('Error restoring:', error);
    showToast('Failed to restore version', 'error');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Sync button
  document.getElementById('syncBtn').addEventListener('click', syncWithAI);
  
  // Edit button
  document.getElementById('editBtn').addEventListener('click', openEditModal);
  
  // Toggle history
  document.getElementById('toggleHistoryBtn').addEventListener('click', toggleHistory);
  
  // Modal close buttons
  document.querySelectorAll('.modal-close, .close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal);
    });
  });
  
  // Save edit button
  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
  
  // Confirm sync button
  document.getElementById('confirmSyncBtn')?.addEventListener('click', confirmSync);
  
  // Character count for edit textarea
  const editTextarea = document.getElementById('editIdeaTextarea');
  editTextarea.addEventListener('input', () => {
    document.getElementById('charCount').textContent = `${editTextarea.value.length} characters`;
  });
  
  // Restore button
  document.getElementById('restoreBtn').addEventListener('click', restoreFromHistory);
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });
  
  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(closeModal);
    }
  });
}

function toggleHistory() {
  const historyList = document.getElementById('historyList');
  const toggleBtn = document.getElementById('toggleHistoryBtn');
  const isExpanded = historyList.classList.toggle('expanded');
  toggleBtn.classList.toggle('expanded', isExpanded);
}

function closeModal(modal) {
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function getSourceIcon(source) {
  switch (source) {
    case 'ai_sync':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>`;
    case 'manual':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>`;
  }
}

function getSourceLabel(source) {
  switch (source) {
    case 'ai_sync':
      return 'AI Sync';
    case 'manual':
      return 'Manual Edit';
    default:
      return 'Update';
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = toast.querySelector('.toast-message');
  toastMessage.textContent = message;
  
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
