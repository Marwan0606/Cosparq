/**
 * PRD & AI Prompt Builder - Frontend Logic
 */

console.log('🚀 prd-builder.js loaded');

const API_BASE = 'http://localhost:5004/api';

// State
let selectedIdeaId = null;
let ideaData = null;
let selectedPlatform = null;
let selectedPromptType = 'fullstack';
let platforms = [];
let promptTypes = [];
let generatedPRD = '';
let generatedPrompt = '';

// History and rate limiting state
let prdHistory = [];
let promptHistory = [];
let lastPrdGeneratedAt = null;
let lastPromptGeneratedAt = null;
let prdCooldown = 300000; // 5 min default
let promptCooldown = 60000; // 1 min default

// Generation state tracking (for handling page refresh during generation)
const GENERATION_TIMEOUT = 120000; // 2 minutes max wait
let pollingInterval = null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// PRD Elements
const generatePrdBtn = document.querySelector('.js-generate-prd');
const prdOutput = document.querySelector('.js-prd-output');
const prdContent = document.querySelector('.js-prd-content');
const copyPrdBtn = document.querySelector('.js-copy-prd');
const downloadPrdBtn = document.querySelector('.js-download-prd');

// History Elements
const prdHistorySection = document.querySelector('.js-prd-history-section');
const prdHistoryList = document.querySelector('.js-prd-history-list');
const prdHistoryCount = document.querySelector('.js-prd-history-count');
const promptHistorySection = document.querySelector('.js-prompt-history-section');
const promptHistoryList = document.querySelector('.js-prompt-history-list');
const promptHistoryCount = document.querySelector('.js-prompt-history-count');

// Prompt Elements
const platformGrid = document.querySelector('.js-platform-grid');
const promptTypeGrid = document.querySelector('.js-prompt-type-grid');
const generatePromptBtn = document.querySelector('.js-generate-prompt');
const promptOutput = document.querySelector('.js-prompt-output');
const promptContent = document.querySelector('.js-prompt-content');
const copyPromptBtn = document.querySelector('.js-copy-prompt');
const techStackSelect = document.querySelector('.js-tech-stack');
const stylingSelect = document.querySelector('.js-styling');
const databaseSelect = document.querySelector('.js-database');

// Toast
const toast = document.querySelector('.js-toast');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOMContentLoaded fired');
  console.log('🔍 Checking DOM elements:', {
    prdHistorySection: !!prdHistorySection,
    prdHistoryList: !!prdHistoryList,
    promptHistorySection: !!promptHistorySection,
    promptHistoryList: !!promptHistoryList,
    prdOutput: !!prdOutput,
    prdContent: !!prdContent,
    promptOutput: !!promptOutput,
    promptContent: !!promptContent
  });
  
  await loadIdeaFromStorage();
  await loadPlatforms();
  await loadHistory();
  setupEventListeners();
  startCooldownTimers();
  checkPendingGenerations();
});

// Load idea from localStorage (same pattern as other pages)
async function loadIdeaFromStorage() {
  try {
    selectedIdeaId = JSON.parse(localStorage.getItem('ideaId'));
    
    if (!selectedIdeaId) {
      showNoIdeaMessage();
      return;
    }

    // Fetch the idea data
    const res = await fetch(`${API_BASE}/save/idea/${selectedIdeaId}`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      showNoIdeaMessage();
      return;
    }
    
    const data = await res.json();
    ideaData = data.idea;
    
    if (!ideaData || !ideaData.idea) {
      showNoIdeaMessage();
      return;
    }

    // Enable buttons
    updateButtonStates();
    
  } catch (err) {
    console.error('Error loading idea:', err);
    showNoIdeaMessage();
  }
}

// Show message when no idea is selected
function showNoIdeaMessage() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <header class="header">
      <h1 class="headline">
        <span class="gradient-text">CoPrompt</span>
      </h1>
    </header>
    <div class="empty-state">
      <svg class="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <h2>No Idea Selected</h2>
      <p>Select an idea from the sidebar to generate PRDs and AI prompts</p>
      <a href="/idea-page.html" class="empty-btn">Create New Idea</a>
    </div>
  `;
}

// Load history from server
async function loadHistory() {
  if (!selectedIdeaId) return;

  try {
    const res = await fetch(`${API_BASE}/prd/history/${selectedIdeaId}`, {
      credentials: 'include'
    });

    if (!res.ok) {
      console.error('Failed to load history, status:', res.status);
      return;
    }

    const data = await res.json();
    console.log('📜 History loaded:', data);
    
    prdHistory = data.prds || [];
    promptHistory = data.prompts || [];
    lastPrdGeneratedAt = data.lastPrdGeneratedAt ? new Date(data.lastPrdGeneratedAt) : null;
    lastPromptGeneratedAt = data.lastPromptGeneratedAt ? new Date(data.lastPromptGeneratedAt) : null;
    prdCooldown = data.prdCooldown || 300000;
    promptCooldown = data.promptCooldown || 60000;

    console.log('📜 PRD history count:', prdHistory.length, 'Prompt history count:', promptHistory.length);

    renderPrdHistory();
    renderPromptHistory();

    // If there's a most recent PRD, show it
    if (prdHistory.length > 0 && prdContent) {
      generatedPRD = prdHistory[0].content;
      prdContent.innerHTML = marked.parse(generatedPRD);
      prdOutput.classList.remove('hidden');
      console.log('📜 Displayed most recent PRD');
    }

    // If there's a most recent prompt, show it
    if (promptHistory.length > 0 && promptContent) {
      generatedPrompt = promptHistory[0].content;
      promptContent.textContent = generatedPrompt;
      
      document.querySelectorAll('.js-platform-name, .js-platform-name-tip').forEach(el => {
        el.textContent = promptHistory[0].platform || 'AI';
      });
      
      promptOutput.classList.remove('hidden');
      console.log('📜 Displayed most recent prompt');
    }

  } catch (err) {
    console.error('Error loading history:', err);
  }
}

// Check if there are pending generations from before a page refresh
function checkPendingGenerations() {
  const prdGenState = getPendingGeneration('prd');
  const promptGenState = getPendingGeneration('prompt');

  // Check for pending PRD generation
  if (prdGenState && prdGenState.ideaId === selectedIdeaId) {
    const elapsed = Date.now() - prdGenState.startTime;
    if (elapsed < GENERATION_TIMEOUT) {
      console.log('🔄 Resuming PRD generation poll...');
      setLoading(generatePrdBtn, true);
      startPollingForCompletion('prd', prdGenState.startTime, prdGenState.historyCount);
    } else {
      // Timeout exceeded, clear the state
      clearPendingGeneration('prd');
    }
  }

  // Check for pending prompt generation
  if (promptGenState && promptGenState.ideaId === selectedIdeaId) {
    const elapsed = Date.now() - promptGenState.startTime;
    if (elapsed < GENERATION_TIMEOUT) {
      console.log('🔄 Resuming prompt generation poll...');
      setLoading(generatePromptBtn, true);
      startPollingForCompletion('prompt', promptGenState.startTime, promptGenState.historyCount);
    } else {
      // Timeout exceeded, clear the state
      clearPendingGeneration('prompt');
    }
  }
}

// Store that a generation has started
function setPendingGeneration(type, ideaId, historyCount) {
  const key = `cosparq_${type}_generating`;
  localStorage.setItem(key, JSON.stringify({
    ideaId,
    startTime: Date.now(),
    historyCount // Number of items before generation started
  }));
}

// Get pending generation state
function getPendingGeneration(type) {
  const key = `cosparq_${type}_generating`;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Clear pending generation state
function clearPendingGeneration(type) {
  const key = `cosparq_${type}_generating`;
  localStorage.removeItem(key);
}

// Poll server for generation completion
function startPollingForCompletion(type, startTime, previousHistoryCount) {
  const pollInterval = 3000; // Poll every 3 seconds
  
  const poll = async () => {
    // Check timeout
    if (Date.now() - startTime > GENERATION_TIMEOUT) {
      console.log(`⏱️ ${type} generation poll timed out`);
      clearPendingGeneration(type);
      if (type === 'prd') {
        setLoading(generatePrdBtn, false);
      } else {
        setLoading(generatePromptBtn, false);
      }
      showToast('Generation timed out. Please try again.', 'error');
      updateButtonStates();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/prd/history/${selectedIdeaId}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        setTimeout(poll, pollInterval);
        return;
      }

      const data = await res.json();

      if (type === 'prd') {
        const newHistory = data.prds || [];
        // Check if we have more PRDs than before (generation completed)
        if (newHistory.length > previousHistoryCount || 
            (newHistory.length > 0 && newHistory[0].createdAt && new Date(newHistory[0].createdAt) > new Date(startTime - 5000))) {
          console.log('✅ PRD generation completed!');
          clearPendingGeneration('prd');
          
          // Update state
          prdHistory = newHistory;
          promptHistory = data.prompts || [];
          lastPrdGeneratedAt = data.lastPrdGeneratedAt ? new Date(data.lastPrdGeneratedAt) : null;
          lastPromptGeneratedAt = data.lastPromptGeneratedAt ? new Date(data.lastPromptGeneratedAt) : null;

          // Show the new PRD
          if (prdHistory.length > 0) {
            generatedPRD = prdHistory[0].content;
            prdContent.innerHTML = marked.parse(generatedPRD);
            prdOutput.classList.remove('hidden');
            renderPrdHistory();
            prdOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast('PRD generated successfully!');
          }

          setLoading(generatePrdBtn, false);
          updateButtonStates();
          return;
        }
      } else {
        const newHistory = data.prompts || [];
        // Check if we have more prompts than before (generation completed)
        if (newHistory.length > previousHistoryCount ||
            (newHistory.length > 0 && newHistory[0].createdAt && new Date(newHistory[0].createdAt) > new Date(startTime - 5000))) {
          console.log('✅ Prompt generation completed!');
          clearPendingGeneration('prompt');
          
          // Update state
          prdHistory = data.prds || [];
          promptHistory = newHistory;
          lastPrdGeneratedAt = data.lastPrdGeneratedAt ? new Date(data.lastPrdGeneratedAt) : null;
          lastPromptGeneratedAt = data.lastPromptGeneratedAt ? new Date(data.lastPromptGeneratedAt) : null;

          // Show the new prompt
          if (promptHistory.length > 0) {
            generatedPrompt = promptHistory[0].content;
            promptContent.textContent = generatedPrompt;
            
            document.querySelectorAll('.js-platform-name, .js-platform-name-tip').forEach(el => {
              el.textContent = promptHistory[0].platform;
            });
            
            promptOutput.classList.remove('hidden');
            renderPromptHistory();
            promptOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast(`${promptHistory[0].platform} prompt generated!`);
          }

          setLoading(generatePromptBtn, false);
          updateButtonStates();
          return;
        }
      }

      // Not ready yet, continue polling
      setTimeout(poll, pollInterval);

    } catch (err) {
      console.error('Polling error:', err);
      setTimeout(poll, pollInterval);
    }
  };

  // Start polling
  poll();
}

// Render PRD history
function renderPrdHistory() {
  console.log('🔄 renderPrdHistory called, elements:', { 
    prdHistorySection: !!prdHistorySection, 
    prdHistoryList: !!prdHistoryList,
    prdHistoryCount: prdHistory.length 
  });
  
  if (!prdHistorySection || !prdHistoryList) {
    console.warn('❌ PRD history elements not found');
    return;
  }

  if (prdHistory.length === 0) {
    prdHistorySection.classList.add('hidden');
    return;
  }

  prdHistorySection.classList.remove('hidden');
  prdHistoryCount.textContent = `${prdHistory.length} of 3`;
  console.log('✅ PRD history section shown with', prdHistory.length, 'items');

  prdHistoryList.innerHTML = prdHistory.map((prd, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-item-header">
        <span class="history-item-title">PRD #${prdHistory.length - index}</span>
        <span class="history-item-date">${formatDate(prd.createdAt)}</span>
      </div>
      <div class="history-item-preview">${escapeHtml(prd.content.substring(0, 150))}...</div>
      <div class="history-item-actions">
        <button class="history-action-btn js-view-prd" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </button>
        <button class="history-action-btn js-copy-history-prd" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners for history items
  prdHistoryList.querySelectorAll('.js-view-prd').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      viewPrdFromHistory(index);
    });
  });

  prdHistoryList.querySelectorAll('.js-copy-history-prd').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      copyToClipboard(prdHistory[index].content);
      showToast('PRD copied to clipboard!');
    });
  });
}

// Render Prompt history
function renderPromptHistory() {
  console.log('🔄 renderPromptHistory called, elements:', { 
    promptHistorySection: !!promptHistorySection, 
    promptHistoryList: !!promptHistoryList,
    promptHistoryCount: promptHistory.length 
  });
  
  if (!promptHistorySection || !promptHistoryList) {
    console.warn('❌ Prompt history elements not found');
    return;
  }

  if (promptHistory.length === 0) {
    promptHistorySection.classList.add('hidden');
    return;
  }

  promptHistorySection.classList.remove('hidden');
  promptHistoryCount.textContent = `${promptHistory.length} of 5`;
  console.log('✅ Prompt history section shown with', promptHistory.length, 'items');

  promptHistoryList.innerHTML = promptHistory.map((prompt, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-item-header">
        <span class="history-item-title">${prompt.platform} - ${prompt.promptType}</span>
        <span class="history-item-date">${formatDate(prompt.createdAt)}</span>
      </div>
      <div class="history-item-preview">${escapeHtml(prompt.content.substring(0, 150))}...</div>
      <div class="history-item-actions">
        <button class="history-action-btn js-view-prompt" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </button>
        <button class="history-action-btn js-copy-history-prompt" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners for history items
  promptHistoryList.querySelectorAll('.js-view-prompt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      viewPromptFromHistory(index);
    });
  });

  promptHistoryList.querySelectorAll('.js-copy-history-prompt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      copyToClipboard(promptHistory[index].content);
      showToast('Prompt copied to clipboard!');
    });
  });
}

// View PRD from history
function viewPrdFromHistory(index) {
  generatedPRD = prdHistory[index].content;
  prdContent.innerHTML = marked.parse(generatedPRD);
  prdOutput.classList.remove('hidden');
  prdOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// View Prompt from history
function viewPromptFromHistory(index) {
  generatedPrompt = promptHistory[index].content;
  promptContent.textContent = generatedPrompt;
  
  document.querySelectorAll('.js-platform-name, .js-platform-name-tip').forEach(el => {
    el.textContent = promptHistory[index].platform;
  });
  
  promptOutput.classList.remove('hidden');
  promptOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
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

// Start cooldown timers
function startCooldownTimers() {
  setInterval(() => {
    updateButtonStates();
  }, 1000);
}

// Get remaining cooldown time
function getRemainingCooldown(lastGenerated, cooldown) {
  if (!lastGenerated) return 0;
  const elapsed = Date.now() - new Date(lastGenerated).getTime();
  return Math.max(0, Math.ceil((cooldown - elapsed) / 1000));
}

// Load platforms and prompt types
async function loadPlatforms() {
  try {
    const res = await fetch(`${API_BASE}/prd/platforms`, {
      credentials: 'include'
    });
    
    if (!res.ok) throw new Error('Failed to load platforms');
    
    const data = await res.json();
    platforms = data.platforms || [];
    promptTypes = data.promptTypes || [];
    
    renderPlatforms();
    renderPromptTypes();
    
  } catch (err) {
    console.error('Error loading platforms:', err);
  }
}

// Render platform buttons
function renderPlatforms() {
  const platformIcons = {
    lovable: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    replit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2 6a4 4 0 0 1 4-4h5v8H4a2 2 0 0 1-2-2V6zm0 10a2 2 0 0 0 2 2h7v-8H4a2 2 0 0 0-2 2v4zm20-8a4 4 0 0 0-4-4h-5v20h5a4 4 0 0 0 4-4V8z"/></svg>`,
    cursor: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>`,
    bolt: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    v0: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    windsurf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`
  };

  platformGrid.innerHTML = platforms.map(p => `
    <button class="platform-btn" data-platform="${p.id}">
      <span class="platform-icon">${platformIcons[p.id] || ''}</span>
      <span class="platform-name">${p.name}</span>
      <span class="platform-desc">${p.description}</span>
    </button>
  `).join('');
}

// Render prompt type buttons
function renderPromptTypes() {
  const typeIcons = {
    initial: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    frontend: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
    backend: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    features: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    fullstack: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>`
  };

  promptTypeGrid.innerHTML = promptTypes.map(pt => `
    <button class="prompt-type-btn ${pt.id === 'fullstack' ? 'active' : ''}" data-type="${pt.id}">
      <span class="type-icon">${typeIcons[pt.id] || ''}</span>
      <span class="type-name">${pt.name}</span>
    </button>
  `).join('');
}

// Setup event listeners
function setupEventListeners() {
  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
      });
    });
  });

  // Platform selection
  platformGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.platform-btn');
    if (!btn) return;
    
    platformGrid.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPlatform = btn.dataset.platform;
    
    updateButtonStates();
  });

  // Prompt type selection
  promptTypeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.prompt-type-btn');
    if (!btn) return;
    
    promptTypeGrid.querySelectorAll('.prompt-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPromptType = btn.dataset.type;
  });

  // Generate PRD
  generatePrdBtn.addEventListener('click', generatePRD);

  // Generate Prompt
  generatePromptBtn.addEventListener('click', generatePromptHandler);

  // Copy PRD
  copyPrdBtn.addEventListener('click', () => {
    copyToClipboard(generatedPRD);
    showToast('PRD copied to clipboard!');
  });

  // Download PRD
  downloadPrdBtn.addEventListener('click', downloadPRD);

  // Copy Prompt
  copyPromptBtn.addEventListener('click', () => {
    copyToClipboard(generatedPrompt);
    showToast('Prompt copied to clipboard!');
  });
}

// Update button states
function updateButtonStates() {
  // PRD button - enabled if we have an idea and cooldown has passed
  if (generatePrdBtn) {
    const prdCooldownRemaining = getRemainingCooldown(lastPrdGeneratedAt, prdCooldown);
    const canGeneratePrd = selectedIdeaId && prdCooldownRemaining === 0;
    generatePrdBtn.disabled = !canGeneratePrd;
    
    if (prdCooldownRemaining > 0) {
      generatePrdBtn.querySelector('.btn-text').textContent = `Wait ${formatCooldown(prdCooldownRemaining)}`;
    } else {
      generatePrdBtn.querySelector('.btn-text').textContent = 'Generate PRD';
    }
  }
  
  // Prompt button - enabled if we have idea, platform, and cooldown passed
  if (generatePromptBtn) {
    const promptCooldownRemaining = getRemainingCooldown(lastPromptGeneratedAt, promptCooldown);
    const canGeneratePrompt = selectedIdeaId && selectedPlatform && promptCooldownRemaining === 0;
    generatePromptBtn.disabled = !canGeneratePrompt;
    
    if (!selectedPlatform) {
      generatePromptBtn.querySelector('.btn-text').textContent = 'Select a Platform First';
    } else if (promptCooldownRemaining > 0) {
      generatePromptBtn.querySelector('.btn-text').textContent = `Wait ${formatCooldown(promptCooldownRemaining)}`;
    } else {
      generatePromptBtn.querySelector('.btn-text').textContent = 'Generate Prompt';
    }
  }
}

// Format cooldown time for display
function formatCooldown(seconds) {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

// Generate PRD
async function generatePRD() {
  if (!selectedIdeaId) {
    showToast('Please select an idea from the sidebar first', 'error');
    return;
  }

  setLoading(generatePrdBtn, true);
  prdOutput.classList.add('hidden');
  
  // Track generation state for page refresh handling
  setPendingGeneration('prd', selectedIdeaId, prdHistory.length);

  try {
    const res = await fetch(`${API_BASE}/prd/generate-prd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ideaId: selectedIdeaId })
    });

    const data = await res.json();

    if (!res.ok) {
      // Handle rate limit error
      if (res.status === 429 && data.remainingSeconds) {
        lastPrdGeneratedAt = new Date(Date.now() - prdCooldown + (data.remainingSeconds * 1000));
      }
      throw new Error(data.error || 'Failed to generate PRD');
    }

    generatedPRD = data.prd;
    
    // Update history state
    prdHistory = data.history || [];
    lastPrdGeneratedAt = new Date();
    
    // Render markdown
    prdContent.innerHTML = marked.parse(generatedPRD);
    prdOutput.classList.remove('hidden');
    
    // Update history UI
    renderPrdHistory();
    
    // Scroll to output
    prdOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast('PRD generated successfully!');

  } catch (err) {
    console.error('PRD Generation Error:', err);
    showToast(err.message || 'Failed to generate PRD', 'error');
  } finally {
    clearPendingGeneration('prd');
    setLoading(generatePrdBtn, false);
    updateButtonStates();
  }
}

// Generate Prompt
async function generatePromptHandler() {
  if (!selectedIdeaId || !selectedPlatform) {
    showToast('Please select an idea and platform', 'error');
    return;
  }

  setLoading(generatePromptBtn, true);
  promptOutput.classList.add('hidden');
  
  // Track generation state for page refresh handling
  setPendingGeneration('prompt', selectedIdeaId, promptHistory.length);

  try {
    const res = await fetch(`${API_BASE}/prd/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ideaId: selectedIdeaId,
        platform: selectedPlatform,
        promptType: selectedPromptType,
        techStack: techStackSelect.value,
        styling: stylingSelect.value,
        database: databaseSelect.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      // Handle rate limit error
      if (res.status === 429 && data.remainingSeconds) {
        lastPromptGeneratedAt = new Date(Date.now() - promptCooldown + (data.remainingSeconds * 1000));
      }
      throw new Error(data.error || 'Failed to generate prompt');
    }

    generatedPrompt = data.prompt;
    
    // Update history state
    promptHistory = data.history || [];
    lastPromptGeneratedAt = new Date();
    
    // Render prompt (as plain text with code styling)
    promptContent.textContent = generatedPrompt;
    
    // Update platform name in UI
    document.querySelectorAll('.js-platform-name, .js-platform-name-tip').forEach(el => {
      el.textContent = data.platform;
    });
    
    promptOutput.classList.remove('hidden');
    
    // Update history UI
    renderPromptHistory();
    
    // Scroll to output
    promptOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast(`${data.platform} prompt generated!`);

  } catch (err) {
    console.error('Prompt Generation Error:', err);
    showToast(err.message || 'Failed to generate prompt', 'error');
  } finally {
    clearPendingGeneration('prompt');
    setLoading(generatePromptBtn, false);
    updateButtonStates();
  }
}

// Download PRD as markdown
function downloadPRD() {
  if (!generatedPRD) return;
  
  const blob = new Blob([generatedPRD], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRD-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('PRD downloaded!');
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// Set loading state
function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

// Show toast notification
function showToast(message, type = 'success') {
  toast.querySelector('.toast-message').textContent = message;
  toast.className = `toast js-toast ${type} visible`;
  
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
