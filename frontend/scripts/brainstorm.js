// BrainStorm Hub JavaScript
axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;

// Auth interceptor
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// ==================== STATE ====================
let sessionId = null;
let ideas = []; // { id, text, source: 'manual'|'ai', branchId: null }
let branches = []; // { id, name, color, position, ideaIds: [] }
let suggestions = [];
let userContext = {
  acceptedTopics: [],
  rejectedSuggestions: [],
  inputHistory: []
};

// Current project info
let currentProject = {
  id: null,
  name: 'Your App',
  description: ''
};

// Rate limiting for AI requests - persisted in localStorage to prevent bypass on refresh
const rateLimiter = {
  storageKey: 'brainstorm_rate_limit',
  maxRequests: 3,
  windowMs: 60000, // 1 minute
  
  getRequests() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      const requests = JSON.parse(stored);
      // Filter out expired requests
      const now = Date.now();
      return requests.filter(t => now - t < this.windowMs);
    } catch {
      return [];
    }
  },
  
  saveRequests(requests) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(requests));
    } catch (e) {
      console.error('Error saving rate limit:', e);
    }
  },
  
  canMakeRequest() {
    const requests = this.getRequests();
    return requests.length < this.maxRequests;
  },
  
  recordRequest() {
    const requests = this.getRequests();
    requests.push(Date.now());
    this.saveRequests(requests);
  },
  
  getTimeUntilNextRequest() {
    if (this.canMakeRequest()) return 0;
    const requests = this.getRequests();
    if (requests.length === 0) return 0;
    const oldest = requests[0];
    return Math.ceil((this.windowMs - (Date.now() - oldest)) / 1000);
  }
};

// Suggestions cache
const suggestionsCache = {
  key: 'brainstorm_suggestions_cache',
  ttlMs: 30 * 60 * 1000, // 30 minutes cache (longer to prevent unnecessary API calls)
  
  get() {
    try {
      const cached = localStorage.getItem(this.key);
      if (!cached) return null;
      const { suggestions, timestamp, projectId } = JSON.parse(cached);
      // Check if cache is still valid and for the same project
      const currentProjectId = JSON.parse(localStorage.getItem('ideaId')) || 'default';
      if (Date.now() - timestamp < this.ttlMs && projectId === currentProjectId) {
        return suggestions;
      }
      return null;
    } catch {
      return null;
    }
  },
  
  set(suggestions) {
    try {
      const projectId = JSON.parse(localStorage.getItem('ideaId')) || 'default';
      localStorage.setItem(this.key, JSON.stringify({
        suggestions,
        timestamp: Date.now(),
        projectId
      }));
    } catch (e) {
      console.error('Error caching suggestions:', e);
    }
  },
  
  clear() {
    localStorage.removeItem(this.key);
  }
};

// Branch positions and colors
const branchConfig = {
  'user-features': { position: 'top-left', color: '#ec4899', name: 'User Features' },
  'ai-integration': { position: 'top-right', color: '#f97316', name: 'AI Integration' },
  'app-pages': { position: 'bottom-left', color: '#ec4899', name: 'App Pages' },
  'innovative': { position: 'bottom-right', color: '#f97316', name: 'Innovative Features' }
};

// Canvas/Pan state - starts small, grows with content
const canvasState = {
  panX: 0,
  panY: 0,
  zoom: 1,
  isPanning: false,
  startX: 0,
  startY: 0,
  canvasWidth: 1800,  // Initial size (fits ~4 branches comfortably)
  canvasHeight: 1400,
  minWidth: 1800,
  minHeight: 1400,
  padding: 400  // Padding around content
};

// Branch dragging state
const dragState = {
  isDragging: false,
  branchId: null,
  branchEl: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0
};

// Thresholds
const ORGANIZE_THRESHOLD = 4; // Number of ideas before showing organize button
const AUTO_ORGANIZE_THRESHOLD = 6; // Auto-organize after this many ideas

// ==================== DOM ELEMENTS ====================
const hubIdeasList = document.getElementById('hub-ideas-list');
const ideaInput = document.getElementById('idea-input');
const addIdeaBtn = document.getElementById('add-idea-btn');
const aiSuggestionsList = document.getElementById('ai-suggestions-list');
const organizeBtn = document.getElementById('organize-btn');
const saveSessionBtn = document.getElementById('save-session-btn');
const clearSessionBtn = document.getElementById('clear-session-btn');
const connectionSvg = document.getElementById('connection-svg');
const projectNameEl = document.getElementById('project-name');
const refreshSuggestionsBtn = document.getElementById('refresh-suggestions-btn');
const canvasContainer = document.getElementById('canvas-container');
const brainstormMain = document.getElementById('brainstorm-main');
const miniMapViewport = document.getElementById('mini-map-viewport');
const miniMapCanvas = document.getElementById('mini-map-canvas');
const zoomIndicator = document.getElementById('zoom-indicator');
const panHint = document.getElementById('pan-hint');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // Center the canvas initially
  centerCanvas();
  
  // Load current project info from localStorage
  await loadProjectInfo();
  
  // Try to load session for this project from the database
  if (currentProject.id) {
    const projectSession = await loadSessionByProject(currentProject.id);
    if (!projectSession) {
      // No existing session for this project, load initial suggestions
      await loadInitialSuggestions();
    }
  } else {
    // No project selected, just load suggestions
    await loadInitialSuggestions();
  }
  
  setupEventListeners();
  setupSvgGradients();
  setupPopupEventListeners();
}

async function loadProjectInfo() {
  try {
    const ideaId = JSON.parse(localStorage.getItem('ideaId'));
    if (ideaId) {
      const response = await axios.get(`/api/save/idea/${ideaId}`);
      if (response.data && response.data.idea) {
        currentProject.id = ideaId;
        currentProject.name = response.data.idea.ideaName || 'Your App';
        currentProject.description = response.data.idea.idea || '';
        
        if (projectNameEl) {
          projectNameEl.textContent = currentProject.name;
        }
      }
    } else {
      if (projectNameEl) {
        projectNameEl.textContent = 'No project selected';
      }
    }
  } catch (error) {
    console.error('Error loading project:', error);
    if (projectNameEl) {
      projectNameEl.textContent = 'Your App';
    }
  }
}

function setupEventListeners() {
  // Add idea on button click
  addIdeaBtn.addEventListener('click', addManualIdea);
  
  // Add idea on Enter key
  ideaInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addManualIdea();
    }
  });
  
  // Generate new suggestions when user STOPS typing (1.5 second delay)
  let typingTimeout;
  ideaInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    // Only trigger after user stops typing for 1.5 seconds
    typingTimeout = setTimeout(() => {
      if (ideaInput.value.trim().length > 3) { // Require at least 4 characters
        loadSuggestionsForInput(ideaInput.value.trim());
      }
    }, 1500); // Increased from 500ms to 1500ms
  });
  
  // Refresh suggestions button
  if (refreshSuggestionsBtn) {
    refreshSuggestionsBtn.addEventListener('click', refreshSuggestions);
  }
  
  // Organize button
  organizeBtn.addEventListener('click', organizeWithAI);
  
  // Session controls
  saveSessionBtn.addEventListener('click', saveSession);
  clearSessionBtn.addEventListener('click', clearSession);
  
  // Window resize - redraw connections
  window.addEventListener('resize', debounce(() => {
    centerCanvas();
    drawConnections();
  }, 200));
  
  // Pan and zoom controls
  setupPanZoomControls();
}

async function refreshSuggestions() {
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    showToast(`Please wait ${waitTime}s before refreshing again`, 'error');
    return;
  }
  
  // Clear cache and force new suggestions
  suggestionsCache.clear();
  refreshSuggestionsBtn.classList.add('spinning');
  await loadInitialSuggestions(true); // Force fetch
  refreshSuggestionsBtn.classList.remove('spinning');
}

// ==================== IDEAS MANAGEMENT ====================
async function addManualIdea() {
  const text = ideaInput.value.trim();
  if (!text) return;
  
  const idea = {
    id: generateId(),
    text: text,
    source: 'manual',
    branchId: null,
    createdAt: new Date()
  };
  
  ideas.push(idea);
  userContext.inputHistory.push(text);
  ideaInput.value = '';
  
  // Auto-categorize the idea
  await categorizeAndAssignIdea(idea);
  
  // Update suggestions based on new context (don't await)
  loadSuggestionsForContext();
}

async function addSuggestionAsIdea(suggestionText, suggestionIndex) {
  const idea = {
    id: generateId(),
    text: suggestionText,
    source: 'ai',
    branchId: null,
    createdAt: new Date()
  };
  
  ideas.push(idea);
  userContext.acceptedTopics.push(suggestionText);
  
  // Remove from suggestions
  suggestions.splice(suggestionIndex, 1);
  renderSuggestions();
  
  // Auto-categorize the idea
  await categorizeAndAssignIdea(idea);
  
  // Load new suggestions based on what user accepted (don't await)
  loadSuggestionsForContext();
}

// Categorize idea and assign to branch
async function categorizeAndAssignIdea(idea) {
  // Show a temporary indicator
  showToast('Categorizing idea...', 'info');
  
  try {
    const response = await axios.post('/api/brainstorm/categorize', {
      ideaText: idea.text,
      existingBranches: branches.map(b => ({
        id: b.id,
        name: b.name,
        ideas: ideas.filter(i => i.branchId === b.id)
      })),
      projectName: currentProject.name,
      projectDescription: currentProject.description
    });
    
    if (response.data.success) {
      if (response.data.action === 'existing' && response.data.branchId) {
        // Assign to existing branch
        idea.branchId = response.data.branchId;
      } else if (response.data.action === 'new' && response.data.newBranch) {
        // Create new branch
        const newBranch = createBranch(response.data.newBranch.name, response.data.newBranch.position);
        idea.branchId = newBranch.id;
      }
      
      renderBranches();
      renderHubIdeas();
      drawConnections();
      
      // Auto-save after categorization
      autoSaveSession();
    }
  } catch (error) {
    console.error('Error categorizing idea:', error);
    // Fallback: put in first branch or create one
    if (branches.length === 0) {
      const newBranch = createBranch('Features', 'top-left');
      idea.branchId = newBranch.id;
    } else {
      idea.branchId = branches[0].id;
    }
    renderBranches();
    renderHubIdeas();
    drawConnections();
    
    // Auto-save even on fallback
    autoSaveSession();
  }
}

// Get color for a branch based on index - uses app's signature gradient colors
function getBranchColor(index) {
  // Signature gradient colors from the app's color scheme
  // Purple -> Red/Orange -> Orange -> Blue gradient
  const colorPalette = [
    '#8400ff', // purple (primary)
    '#f94016', // red-orange
    '#f97316', // orange
    '#3b82f6', // blue
    '#ec4899', // pink
    '#f96d16', // bright orange
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#a855f7', // purple variant
    '#fb923c', // light orange
  ];
  
  return colorPalette[index % colorPalette.length];
}

// Create a new branch
function createBranch(name, suggestedPosition) {
  // Get the next available index
  const positionIndex = branches.length;
  
  const branch = {
    id: 'branch-' + Date.now(),
    name: name,
    positionIndex: positionIndex,
    color: getBranchColor(positionIndex)
  };
  
  branches.push(branch);
  
  // Update canvas size if needed (before creating element so position is correct)
  updateCanvasSize();
  
  // Create the DOM element for the branch
  createBranchElement(branch);
  
  // Update mini map
  updateMiniMapBranches();
  
  return branch;
}

// Create DOM element for a branch (compact card style)
function createBranchElement(branch) {
  const existingEl = document.getElementById(`branch-${branch.id}`);
  if (existingEl) return; // Already exists
  
  // Use custom position if set, otherwise get from spiral layout
  let pos;
  if (branch.customX !== undefined && branch.customY !== undefined) {
    pos = { x: branch.customX, y: branch.customY };
  } else {
    // Get position index, ensuring it's a valid number
    let posIndex = branch.positionIndex;
    if (posIndex === undefined || posIndex < 0) {
      posIndex = branches.indexOf(branch);
      if (posIndex < 0) posIndex = 0;
      branch.positionIndex = posIndex; // Save it back to branch
    }
    pos = getBranchPosition(posIndex);
  }
  
  const branchEl = document.createElement('div');
  branchEl.id = `branch-${branch.id}`;
  branchEl.className = 'branch';
  branchEl.dataset.branchId = branch.id;
  branchEl.style.left = `${pos.x}px`;
  branchEl.style.top = `${pos.y}px`;
  branchEl.innerHTML = `
    <div class="branch-header">
      <h3 class="branch-title" style="color: ${branch.color}">${escapeHtml(branch.name)}</h3>
      <span class="branch-count">0 ideas</span>
    </div>
    <div class="branch-ideas"></div>
    <div class="branch-more-indicator" style="display: none;">Click to see all →</div>
  `;
  
  // Add drag functionality
  setupBranchDrag(branchEl, branch);
  
  // Add to canvas container (not main)
  const canvas = document.getElementById('canvas-container');
  if (canvas) {
    canvas.appendChild(branchEl);
  }
  
  // Animate in
  setTimeout(() => branchEl.classList.add('visible'), 50);
}

// Setup drag handlers for a branch element
function setupBranchDrag(branchEl, branch) {
  let hasDragged = false;
  
  branchEl.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on title or buttons
    if (e.target.classList.contains('branch-title') || 
        e.target.tagName === 'BUTTON' ||
        e.target.closest('.branch-more-indicator')) {
      return;
    }
    
    e.stopPropagation(); // Prevent canvas panning
    
    hasDragged = false;
    dragState.isDragging = true;
    dragState.branchId = branch.id;
    dragState.branchEl = branchEl;
    
    // Calculate offset from mouse to branch top-left corner
    const branchRect = branchEl.getBoundingClientRect();
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Account for zoom and pan
    dragState.offsetX = (e.clientX - branchRect.left);
    dragState.offsetY = (e.clientY - branchRect.top);
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    
    branchEl.classList.add('dragging');
    branchEl.style.zIndex = '100';
    branchEl.style.cursor = 'grabbing';
  });
  
  // Click handler - only open popup if not dragged
  branchEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('branch-title')) return;
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    openBranchPopup(branch.id);
  });
  
  // Global mousemove for dragging
  document.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging || dragState.branchId !== branch.id) return;
    
    // Check if we've moved enough to consider it a drag
    const dx = Math.abs(e.clientX - dragState.startX);
    const dy = Math.abs(e.clientY - dragState.startY);
    if (dx > 5 || dy > 5) {
      hasDragged = true;
    }
    
    // Calculate new position in canvas coordinates
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Convert mouse position to canvas coordinates (accounting for zoom and pan)
    let newX = (e.clientX - canvasRect.left) / canvasState.zoom - dragState.offsetX / canvasState.zoom;
    let newY = (e.clientY - canvasRect.top) / canvasState.zoom - dragState.offsetY / canvasState.zoom;
    
    // Prevent dragging into the central hub area
    const hubCenterX = canvasState.canvasWidth / 2;
    const hubCenterY = canvasState.canvasHeight / 2;
    const hubExclusionRadius = 300; // Keep branches away from center
    const branchWidth = branchEl.offsetWidth || 260;
    const branchHeight = branchEl.offsetHeight || 150;
    
    // Calculate branch center
    const branchCenterX = newX + branchWidth / 2;
    const branchCenterY = newY + branchHeight / 2;
    
    // Check distance from hub center
    const distFromHub = Math.sqrt(
      Math.pow(branchCenterX - hubCenterX, 2) + 
      Math.pow(branchCenterY - hubCenterY, 2)
    );
    
    // If too close to hub, push it out
    if (distFromHub < hubExclusionRadius) {
      const angle = Math.atan2(branchCenterY - hubCenterY, branchCenterX - hubCenterX);
      newX = hubCenterX + Math.cos(angle) * hubExclusionRadius - branchWidth / 2;
      newY = hubCenterY + Math.sin(angle) * hubExclusionRadius - branchHeight / 2;
    }
    
    // Update element position
    branchEl.style.left = `${newX}px`;
    branchEl.style.top = `${newY}px`;
    
    // Update connection lines in real-time
    drawConnections();
  });
  
  // Global mouseup to end dragging
  document.addEventListener('mouseup', (e) => {
    if (!dragState.isDragging || dragState.branchId !== branch.id) return;
    
    // Save the custom position to the branch object
    const newX = parseFloat(branchEl.style.left);
    const newY = parseFloat(branchEl.style.top);
    
    branch.customX = newX;
    branch.customY = newY;
    
    // Reset drag state
    branchEl.classList.remove('dragging');
    branchEl.style.zIndex = '';
    branchEl.style.cursor = '';
    
    dragState.isDragging = false;
    dragState.branchId = null;
    dragState.branchEl = null;
    
    // Update mini map
    updateMiniMapBranches();
    
    // Final connection redraw
    drawConnections();
    
    // Auto-save session to persist the new position
    if (hasDragged) {
      autoSaveSession();
    }
  });
}

function removeIdea(ideaId) {
  const index = ideas.findIndex(i => i.id === ideaId);
  if (index > -1) {
    ideas.splice(index, 1);
    renderHubIdeas();
    renderBranches();
    checkOrganizeThreshold();
  }
}

function updateIdeaText(ideaId, newText) {
  const idea = ideas.find(i => i.id === ideaId);
  if (idea) {
    idea.text = newText;
  }
}

// ==================== RENDERING ====================
function renderHubIdeas() {
  const unbrachedIdeas = ideas.filter(i => !i.branchId);
  
  if (unbrachedIdeas.length === 0) {
    hubIdeasList.innerHTML = '';
    return;
  }
  
  hubIdeasList.innerHTML = unbrachedIdeas.map(idea => `
    <div class="idea-item" data-idea-id="${idea.id}" draggable="true">
      <span class="idea-text" contenteditable="true">${escapeHtml(idea.text)}</span>
      <div class="idea-actions">
        <button class="idea-action-btn delete-btn" title="Remove" onclick="removeIdea('${idea.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  // Add edit listeners
  hubIdeasList.querySelectorAll('.idea-text').forEach(el => {
    el.addEventListener('blur', (e) => {
      const ideaId = e.target.closest('.idea-item').dataset.ideaId;
      updateIdeaText(ideaId, e.target.textContent.trim());
    });
  });
  
  // Add drag listeners
  setupDragAndDrop();
}

function renderSuggestions() {
  if (suggestions.length === 0) {
    aiSuggestionsList.innerHTML = `
      <div class="suggestions-loading">
        <span>No suggestions yet. Type something to get started!</span>
      </div>
    `;
    return;
  }
  
  aiSuggestionsList.innerHTML = suggestions.map((suggestion, index) => `
    <div class="suggestion-item" data-index="${index}">
      <span class="suggestion-text">${escapeHtml(suggestion)}</span>
      <button class="add-suggestion-btn" title="Add this idea" onclick="addSuggestionAsIdea('${escapeHtml(suggestion).replace(/'/g, "\\'")}', ${index})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function renderBranches() {
  // First, ensure all branches have DOM elements
  branches.forEach(branch => {
    createBranchElement(branch);
  });
  
  // Then update each branch's content
  branches.forEach(branch => {
    const branchEl = document.getElementById(`branch-${branch.id}`);
    if (!branchEl) return;
    
    const branchIdeas = ideas.filter(i => i.branchId === branch.id);
    const ideasContainer = branchEl.querySelector('.branch-ideas');
    
    if (branchIdeas.length > 0) {
      branchEl.style.display = 'block';
      branchEl.classList.add('visible');
      
      // Update title
      const titleEl = branchEl.querySelector('.branch-title');
      titleEl.textContent = branch.name;
      titleEl.style.color = branch.color;
      
      // Update count
      const countEl = branchEl.querySelector('.branch-count');
      if (countEl) {
        countEl.textContent = `${branchIdeas.length} idea${branchIdeas.length !== 1 ? 's' : ''}`;
      }
      
      // Show only last 3 ideas (newest first)
      const recentIdeas = branchIdeas.slice(-3).reverse();
      ideasContainer.innerHTML = recentIdeas.map(idea => `
        <div class="branch-idea-item" data-idea-id="${idea.id}">
          <span class="idea-text">${escapeHtml(idea.text)}</span>
        </div>
      `).join('');
      
      // Show "more" indicator if there are more than 3 ideas
      const moreIndicator = branchEl.querySelector('.branch-more-indicator');
      if (moreIndicator) {
        moreIndicator.style.display = branchIdeas.length > 3 ? 'block' : 'none';
      }
    } else {
      branchEl.style.display = 'none';
    }
  });
  
  // Draw connections
  setTimeout(drawConnections, 100);
}

// ==================== AI INTEGRATION ====================
async function loadInitialSuggestions(forceFetch = false) {
  // Check cache first (unless forced)
  if (!forceFetch) {
    const cachedSuggestions = suggestionsCache.get();
    if (cachedSuggestions && cachedSuggestions.length > 0) {
      console.log('Using cached suggestions');
      suggestions = cachedSuggestions;
      renderSuggestions();
      return;
    }
  }
  
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    showToast(`AI rate limit reached. Wait ${waitTime}s`, 'error');
    // Use defaults or cached
    suggestions = getDefaultSuggestions();
    renderSuggestions();
    return;
  }
  
  showSuggestionsLoading();
  
  try {
    rateLimiter.recordRequest();
    
    const response = await axios.post('/api/brainstorm/suggest', {
      context: '',
      existingIdeas: [],
      userPreferences: userContext,
      projectName: currentProject.name,
      projectDescription: currentProject.description
    });
    
    if (response.data.success) {
      suggestions = response.data.suggestions;
      suggestionsCache.set(suggestions); // Cache the results
      renderSuggestions();
    }
  } catch (error) {
    console.error('Error loading suggestions:', error);
    suggestions = getDefaultSuggestions();
    renderSuggestions();
  }
}

async function loadSuggestionsForInput(input) {
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    showToast(`AI rate limit reached. Wait ${waitTime}s`, 'error');
    return;
  }
  
  showSuggestionsLoading();
  
  try {
    rateLimiter.recordRequest();
    
    const response = await axios.post('/api/brainstorm/suggest', {
      context: input,
      existingIdeas: ideas.map(i => i.text),
      userPreferences: userContext,
      projectName: currentProject.name,
      projectDescription: currentProject.description
    });
    
    if (response.data.success) {
      suggestions = response.data.suggestions;
      suggestionsCache.set(suggestions); // Cache the results
      renderSuggestions();
    }
  } catch (error) {
    console.error('Error loading suggestions:', error);
    renderSuggestions();
  }
}

async function loadSuggestionsForContext() {
  // Check cache first
  const cachedSuggestions = suggestionsCache.get();
  if (cachedSuggestions && cachedSuggestions.length > 0) {
    console.log('Using cached suggestions for context');
    suggestions = cachedSuggestions;
    renderSuggestions();
    return;
  }
  
  // Check rate limit - silently fail if at limit
  if (!rateLimiter.canMakeRequest()) {
    // Use default suggestions if rate limited and no cache
    suggestions = getDefaultSuggestions();
    renderSuggestions();
    return;
  }
  
  // Don't show loading spinner, just update in background
  try {
    rateLimiter.recordRequest();
    
    const response = await axios.post('/api/brainstorm/suggest', {
      context: userContext.inputHistory.slice(-3).join(', '),
      existingIdeas: ideas.map(i => i.text),
      userPreferences: userContext,
      projectName: currentProject.name,
      projectDescription: currentProject.description
    });
    
    if (response.data.success) {
      suggestions = response.data.suggestions;
      suggestionsCache.set(suggestions); // Cache the results
      renderSuggestions();
    }
  } catch (error) {
    console.error('Error loading context suggestions:', error);
  }
}

async function organizeWithAI() {
  if (ideas.length < 2) {
    showToast('Add more ideas before organizing', 'error');
    return;
  }
  
  organizeBtn.classList.add('loading');
  organizeBtn.innerHTML = `
    <div class="loading-spinner"></div>
    Organizing...
  `;
  
  try {
    const response = await axios.post('/api/brainstorm/organize', {
      ideas: ideas.map(i => ({ id: i.id, text: i.text })),
      existingBranches: branches
    });
    
    if (response.data.success) {
      // Update branches with AI response
      branches = response.data.branches;
      
      // Assign ideas to branches
      response.data.ideaAssignments.forEach(assignment => {
        const idea = ideas.find(i => i.id === assignment.ideaId);
        if (idea) {
          idea.branchId = assignment.branchId;
        }
      });
      
      renderHubIdeas();
      renderBranches();
      
      showToast('Ideas organized!', 'success');
    }
  } catch (error) {
    console.error('Error organizing:', error);
    showToast('Failed to organize. Try again.', 'error');
  } finally {
    organizeBtn.classList.remove('loading');
    organizeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Organize with AI
    `;
  }
}

// ==================== SESSION MANAGEMENT ====================
// Debounced auto-save (silent, no toast)
let autoSaveTimeout = null;
async function autoSaveSession() {
  // Debounce - wait 1 second after last change before saving
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  autoSaveTimeout = setTimeout(async () => {
    try {
      const response = await axios.post('/api/brainstorm/session', {
        sessionId: sessionId,
        projectId: currentProject.id,  // Include project ID for cross-device sync
        ideas: ideas,
        branches: branches,
        userContext: userContext
      });
      
      if (response.data.success) {
        sessionId = response.data.sessionId;
        console.log('Session auto-saved');
      }
    } catch (error) {
      console.error('Error auto-saving session:', error);
    }
  }, 1000);
}

async function saveSession() {
  try {
    const response = await axios.post('/api/brainstorm/session', {
      sessionId: sessionId,
      projectId: currentProject.id,  // Include project ID for cross-device sync
      ideas: ideas,
      branches: branches,
      userContext: userContext
    });
    
    if (response.data.success) {
      sessionId = response.data.sessionId;
      
      showToast('Session saved!', 'success');
    }
  } catch (error) {
    console.error('Error saving session:', error);
    showToast('Failed to save session', 'error');
  }
}

async function loadSession(id) {
  try {
    const response = await axios.get(`/api/brainstorm/session/${id}`);
    
    if (response.data.success) {
      sessionId = id;
      ideas = response.data.session.ideas || [];
      branches = response.data.session.branches || [];
      userContext = response.data.session.userContext || userContext;
      
      // Ensure all branches have positionIndex and color (for backwards compatibility)
      branches.forEach((branch, index) => {
        if (branch.positionIndex === undefined) {
          branch.positionIndex = index;
        }
        if (!branch.color) {
          branch.color = getBranchColor(branch.positionIndex);
        }
      });
      
      renderHubIdeas();
      renderBranches();
      checkOrganizeThreshold();
      
      // Load suggestions for current context
      loadSuggestionsForContext();
    }
  } catch (error) {
    console.error('Error loading session:', error);
    // Start fresh
    loadInitialSuggestions();
  }
}

// Load session by project ID (for cross-device sync)
async function loadSessionByProject(projectId) {
  try {
    const response = await axios.get(`/api/brainstorm/session/project/${projectId}`);
    
    if (response.data.success && response.data.session) {
      sessionId = response.data.session._id;
      ideas = response.data.session.ideas || [];
      branches = response.data.session.branches || [];
      userContext = response.data.session.userContext || userContext;
      
      // Ensure all branches have positionIndex and color (for backwards compatibility)
      branches.forEach((branch, index) => {
        if (branch.positionIndex === undefined) {
          branch.positionIndex = index;
        }
        if (!branch.color) {
          branch.color = getBranchColor(branch.positionIndex);
        }
      });
      
      renderHubIdeas();
      renderBranches();
      checkOrganizeThreshold();
      
      // Load suggestions for current context
      loadSuggestionsForContext();
      
      console.log('Session loaded for project:', projectId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading session by project:', error);
    return false;
  }
}

function clearSession() {
  if (!confirm('Clear all ideas and branches? This cannot be undone.')) return;
  
  ideas = [];
  branches = [];
  sessionId = null;
  userContext = { acceptedTopics: [], rejectedSuggestions: [], inputHistory: [] };
  
  localStorage.removeItem('brainstormSessionId');
  window.history.replaceState({}, '', window.location.pathname);
  
  // Hide all branches
  document.querySelectorAll('.branch').forEach(b => b.style.display = 'none');
  
  renderHubIdeas();
  clearConnections();
  loadInitialSuggestions();
  
  organizeBtn.style.display = 'none';
  
  showToast('Session cleared', 'success');
}

// ==================== PAN & ZOOM ====================
function centerCanvas() {
  const mainRect = brainstormMain.getBoundingClientRect();
  const centerX = (mainRect.width / 2) - (canvasState.canvasWidth / 2);
  const centerY = (mainRect.height / 2) - (canvasState.canvasHeight / 2);
  
  canvasState.panX = centerX;
  canvasState.panY = centerY;
  
  updateCanvasTransform();
  updateMiniMap();
  
  // Hide pan hint after first interaction
  setTimeout(() => {
    if (panHint) panHint.classList.add('hidden');
  }, 5000);
}

function updateCanvasTransform() {
  if (canvasContainer) {
    canvasContainer.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
    canvasContainer.style.width = `${canvasState.canvasWidth}px`;
    canvasContainer.style.height = `${canvasState.canvasHeight}px`;
  }
  if (zoomIndicator) {
    zoomIndicator.textContent = `${Math.round(canvasState.zoom * 100)}%`;
  }
}

// Clamp pan values to keep canvas within bounds
function clampPan() {
  const mainRect = brainstormMain.getBoundingClientRect();
  const viewWidth = mainRect.width;
  const viewHeight = mainRect.height;
  
  const scaledCanvasWidth = canvasState.canvasWidth * canvasState.zoom;
  const scaledCanvasHeight = canvasState.canvasHeight * canvasState.zoom;
  
  // Calculate boundaries - allow some margin but don't let canvas escape view
  const margin = 100; // Small margin at edges
  
  // Max pan is when left/top edge of canvas is at right/bottom of view (minus margin)
  const maxPanX = viewWidth - margin;
  const maxPanY = viewHeight - margin;
  
  // Min pan is when right/bottom edge of canvas is at left/top of view (plus margin)
  const minPanX = -(scaledCanvasWidth - margin);
  const minPanY = -(scaledCanvasHeight - margin);
  
  canvasState.panX = Math.max(minPanX, Math.min(maxPanX, canvasState.panX));
  canvasState.panY = Math.max(minPanY, Math.min(maxPanY, canvasState.panY));
}

function setupPanZoomControls() {
  // Mouse drag to pan
  brainstormMain.addEventListener('mousedown', (e) => {
    // Don't pan if we're dragging a branch
    if (dragState.isDragging) return;
    
    // Only start panning if clicking on the main area (not on interactive elements)
    if (e.target === brainstormMain || e.target.classList.contains('background-gradient') || 
        e.target === canvasContainer || e.target.classList.contains('canvas-container')) {
      canvasState.isPanning = true;
      canvasState.startX = e.clientX - canvasState.panX;
      canvasState.startY = e.clientY - canvasState.panY;
      brainstormMain.classList.add('panning');
      
      // Hide pan hint on first interaction
      if (panHint) panHint.classList.add('hidden');
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    // Don't pan if we're dragging a branch
    if (dragState.isDragging) return;
    if (!canvasState.isPanning) return;
    
    canvasState.panX = e.clientX - canvasState.startX;
    canvasState.panY = e.clientY - canvasState.startY;
    
    // Apply boundaries
    clampPan();
    
    updateCanvasTransform();
    updateMiniMap();
  });
  
  document.addEventListener('mouseup', () => {
    if (canvasState.isPanning) {
      canvasState.isPanning = false;
      brainstormMain.classList.remove('panning');
      drawConnections();
    }
  });
  
  // Mouse wheel to zoom
  brainstormMain.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(1.5, canvasState.zoom + delta));
    
    if (newZoom !== canvasState.zoom) {
      // Zoom towards mouse position
      const rect = brainstormMain.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomRatio = newZoom / canvasState.zoom;
      
      canvasState.panX = mouseX - (mouseX - canvasState.panX) * zoomRatio;
      canvasState.panY = mouseY - (mouseY - canvasState.panY) * zoomRatio;
      canvasState.zoom = newZoom;
      
      // Apply boundaries after zoom
      clampPan();
      
      updateCanvasTransform();
      updateMiniMap();
    }
  }, { passive: false });
  
  // Center view button
  const centerBtn = document.getElementById('center-view-btn');
  if (centerBtn) {
    centerBtn.addEventListener('click', () => {
      canvasState.zoom = 1;
      centerCanvas();
      drawConnections();
    });
  }
  
  // Zoom in button
  const zoomInBtn = document.getElementById('zoom-in-btn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      canvasState.zoom = Math.min(1.5, canvasState.zoom + 0.2);
      clampPan();
      updateCanvasTransform();
      updateMiniMap();
    });
  }
  
  // Zoom out button
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      canvasState.zoom = Math.max(0.5, canvasState.zoom - 0.2);
      clampPan();
      updateCanvasTransform();
      updateMiniMap();
    });
  }
}

function updateMiniMap() {
  if (!miniMapViewport || !miniMapCanvas) return;
  
  const mainRect = brainstormMain.getBoundingClientRect();
  const mapWidth = miniMapCanvas.offsetWidth;
  const mapHeight = miniMapCanvas.offsetHeight;
  
  // Calculate viewport size and position on mini map
  const scaleX = mapWidth / canvasState.canvasWidth;
  const scaleY = mapHeight / canvasState.canvasHeight;
  
  const viewportWidth = (mainRect.width / canvasState.zoom) * scaleX;
  const viewportHeight = (mainRect.height / canvasState.zoom) * scaleY;
  
  const viewportX = (-canvasState.panX / canvasState.zoom) * scaleX;
  const viewportY = (-canvasState.panY / canvasState.zoom) * scaleY;
  
  miniMapViewport.style.width = `${viewportWidth}px`;
  miniMapViewport.style.height = `${viewportHeight}px`;
  miniMapViewport.style.left = `${viewportX}px`;
  miniMapViewport.style.top = `${viewportY}px`;
  
  // Update branch markers on mini map
  updateMiniMapBranches();
}

function updateMiniMapBranches() {
  if (!miniMapCanvas) return;
  
  // Remove old branch markers
  miniMapCanvas.querySelectorAll('.mini-map-branch').forEach(el => el.remove());
  
  const mapWidth = miniMapCanvas.offsetWidth;
  const mapHeight = miniMapCanvas.offsetHeight;
  const scaleX = mapWidth / canvasState.canvasWidth;
  const scaleY = mapHeight / canvasState.canvasHeight;
  
  branches.forEach((branch, index) => {
    // Use custom position if set, otherwise use calculated position
    let pos;
    if (branch.customX !== undefined && branch.customY !== undefined) {
      pos = { x: branch.customX, y: branch.customY };
    } else {
      // Ensure valid positionIndex
      let posIndex = branch.positionIndex;
      if (posIndex === undefined || posIndex < 0) {
        posIndex = index;
      }
      pos = getBranchPosition(posIndex);
    }
    
    const marker = document.createElement('div');
    marker.className = 'mini-map-branch';
    marker.style.left = `${pos.x * scaleX}px`;
    marker.style.top = `${pos.y * scaleY}px`;
    marker.style.background = branch.color;
    
    miniMapCanvas.appendChild(marker);
  });
}

// Calculate required canvas size based on number of branches
function calculateRequiredCanvasSize(branchCount) {
  const branchWidth = 280;
  const branchHeight = 200;
  const firstRingDistance = 500;
  const ringSpacing = 400;
  const hubSize = 500; // Approximate hub size
  
  if (branchCount <= 8) {
    // Just first ring - fixed size
    return {
      width: Math.max(canvasState.minWidth, (firstRingDistance + branchWidth) * 2 + hubSize),
      height: Math.max(canvasState.minHeight, (firstRingDistance + branchHeight) * 2 + hubSize)
    };
  }
  
  // Calculate which ring we need
  let remaining = branchCount - 8;
  let ring = 1;
  let positionsInRing = 12;
  
  while (remaining > positionsInRing) {
    remaining -= positionsInRing;
    ring++;
    positionsInRing = 12 + (ring - 1) * 4;
  }
  
  const maxDistance = firstRingDistance + (ring * ringSpacing) + branchWidth + canvasState.padding;
  
  return {
    width: Math.max(canvasState.minWidth, maxDistance * 2),
    height: Math.max(canvasState.minHeight, maxDistance * 2)
  };
}

// Update canvas size when branches change
function updateCanvasSize() {
  const requiredSize = calculateRequiredCanvasSize(branches.length);
  
  const sizeChanged = canvasState.canvasWidth !== requiredSize.width || 
                      canvasState.canvasHeight !== requiredSize.height;
  
  if (sizeChanged) {
    canvasState.canvasWidth = requiredSize.width;
    canvasState.canvasHeight = requiredSize.height;
    
    // Update SVG size
    connectionSvg.style.width = `${canvasState.canvasWidth}px`;
    connectionSvg.style.height = `${canvasState.canvasHeight}px`;
    connectionSvg.setAttribute('viewBox', `0 0 ${canvasState.canvasWidth} ${canvasState.canvasHeight}`);
    
    // Reposition all branches since center point changed
    repositionAllBranches();
    
    // Update canvas container
    updateCanvasTransform();
    
    // Re-center if needed
    clampPan();
    updateCanvasTransform();
    updateMiniMap();
  }
}

// Reposition all existing branch elements to match current canvas size
// Only repositions branches that don't have custom positions
function repositionAllBranches() {
  branches.forEach((branch, index) => {
    const branchEl = document.getElementById(`branch-${branch.id}`);
    if (!branchEl) return;
    
    // Skip branches with custom positions (user has manually placed them)
    if (branch.customX !== undefined && branch.customY !== undefined) {
      return;
    }
    
    // Ensure positionIndex is valid
    let posIndex = branch.positionIndex;
    if (posIndex === undefined || posIndex < 0) {
      posIndex = index;
      branch.positionIndex = posIndex;
    }
    
    const pos = getBranchPosition(posIndex);
    branchEl.style.left = `${pos.x}px`;
    branchEl.style.top = `${pos.y}px`;
  });
  
  // Update hub position as well
  const hub = document.getElementById('central-hub');
  if (hub) {
    hub.style.left = `${canvasState.canvasWidth / 2}px`;
    hub.style.top = `${canvasState.canvasHeight / 2}px`;
  }
}

// Get absolute position for a branch based on index (spiral layout)
function getBranchPosition(index) {
  const centerX = canvasState.canvasWidth / 2;
  const centerY = canvasState.canvasHeight / 2;
  
  // First ring (0-7): 8 positions around the hub
  // Second ring (8+): more positions further out
  
  const firstRingDistance = 500; // Distance for first 8 branches
  const ringSpacing = 400; // Distance between rings
  const branchWidth = 280; // Approximate branch width
  const branchHeight = 200; // Approximate branch height
  
  // For the first 8 branches, place them in fixed positions around the hub
  if (index < 8) {
    // 8 positions: corners + cardinals (evenly spaced)
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2; // Start from top, go clockwise
    
    return {
      x: centerX + Math.cos(angle) * firstRingDistance - branchWidth / 2,
      y: centerY + Math.sin(angle) * firstRingDistance - branchHeight / 2
    };
  }
  
  // For subsequent branches, use spiral layout
  const adjustedIndex = index - 8;
  let ring = 1;
  let posInRing = adjustedIndex;
  let positionsInRing = 12; // 12 positions in second ring
  
  while (posInRing >= positionsInRing) {
    posInRing -= positionsInRing;
    ring++;
    positionsInRing = 12 + (ring - 1) * 4; // Increase positions per ring
  }
  
  const distance = firstRingDistance + (ring * ringSpacing);
  const angleOffset = (ring % 2) * (Math.PI / positionsInRing); // Alternate offset
  const angle = (posInRing / positionsInRing) * Math.PI * 2 + angleOffset - Math.PI / 2; // Start from top
  
  return {
    x: centerX + Math.cos(angle) * distance - branchWidth/2,
    y: centerY + Math.sin(angle) * distance - branchHeight/2
  };
}

// ==================== CONNECTION LINES ====================
function setupSvgGradients() {
  // Set SVG to cover the entire canvas
  connectionSvg.style.width = `${canvasState.canvasWidth}px`;
  connectionSvg.style.height = `${canvasState.canvasHeight}px`;
  connectionSvg.setAttribute('viewBox', `0 0 ${canvasState.canvasWidth} ${canvasState.canvasHeight}`);
  
  connectionSvg.innerHTML = `
    <defs>
      <linearGradient id="gradient-purple" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#8400ff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="gradient-pink" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#ec4899;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#f472b6;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
      </linearGradient>
    </defs>
  `;
}

function drawConnections() {
  // Clear existing lines (keep gradients)
  const existingLines = connectionSvg.querySelectorAll('.connection-line');
  existingLines.forEach(line => line.remove());
  
  const hub = document.getElementById('central-hub');
  if (!hub) return;
  
  // Get hub center in canvas coordinates
  const hubCenterX = canvasState.canvasWidth / 2;
  const hubCenterY = canvasState.canvasHeight / 2;
  
  const visibleBranches = document.querySelectorAll('.branch.visible');
  
  visibleBranches.forEach((branchEl, index) => {
    const branchId = branchEl.dataset.branchId;
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    
    // Get branch position from its style (already set by createBranchElement)
    const branchLeft = parseFloat(branchEl.style.left) || 0;
    const branchTop = parseFloat(branchEl.style.top) || 0;
    
    // Get branch dimensions
    const branchWidth = branchEl.offsetWidth || 200;
    const branchHeight = branchEl.offsetHeight || 100;
    
    // Calculate connection point on branch (center-ish, towards the hub)
    let branchX, branchY;
    
    // Determine which side of the hub the branch is on
    const dx = (branchLeft + branchWidth/2) - hubCenterX;
    const dy = (branchTop + branchHeight/2) - hubCenterY;
    
    // Connect from the side of branch closest to hub
    if (Math.abs(dx) > Math.abs(dy)) {
      // Branch is more horizontal from hub
      branchX = dx > 0 ? branchLeft : branchLeft + branchWidth;
      branchY = branchTop + 40; // Near title
    } else {
      // Branch is more vertical from hub
      branchX = branchLeft + branchWidth / 2;
      branchY = dy > 0 ? branchTop : branchTop + branchHeight;
    }
    
    // Create curved path from hub to branch
    const path = createCurvedPathSimple(hubCenterX, hubCenterY, branchX, branchY);
    
    // Use the branch's actual color for the connection line
    const branchColor = branch.color || getBranchColor(branch.positionIndex || index);
    
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('class', 'connection-line');
    pathEl.setAttribute('stroke', branchColor);
    
    connectionSvg.appendChild(pathEl);
    
    // Animate in
    setTimeout(() => pathEl.classList.add('visible'), 50);
  });
}

function createCurvedPathSimple(x1, y1, x2, y2) {
  // Calculate direction vector
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control point offset (curve intensity)
  const curveIntensity = distance * 0.3;
  
  // Calculate perpendicular direction for curve
  const perpX = -dy / distance;
  const perpY = dx / distance;
  
  // Single control point for quadratic curve
  const cpX = (x1 + x2) / 2 + perpX * curveIntensity * 0.3;
  const cpY = (y1 + y2) / 2 + perpY * curveIntensity * 0.3;
  
  return `M ${x1} ${y1} Q ${cpX} ${cpY}, ${x2} ${y2}`;
}

function createCurvedPath(x1, y1, x2, y2, position) {
  // Create a curved bezier path
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  let cp1x, cp1y, cp2x, cp2y;
  
  // Control points based on position for nice curves
  switch(position) {
    case 'top-left':
      cp1x = x1 - 50;
      cp1y = y1 - 30;
      cp2x = x2 + 30;
      cp2y = y2 + 50;
      break;
    case 'top-right':
      cp1x = x1 + 50;
      cp1y = y1 - 30;
      cp2x = x2 - 30;
      cp2y = y2 + 50;
      break;
    case 'bottom-left':
      cp1x = x1 - 50;
      cp1y = y1 + 30;
      cp2x = x2 + 30;
      cp2y = y2 - 50;
      break;
    case 'bottom-right':
      cp1x = x1 + 50;
      cp1y = y1 + 30;
      cp2x = x2 - 30;
      cp2y = y2 - 50;
      break;
    default:
      cp1x = midX;
      cp1y = y1;
      cp2x = midX;
      cp2y = y2;
  }
  
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function clearConnections() {
  const existingLines = connectionSvg.querySelectorAll('.connection-line');
  existingLines.forEach(line => line.remove());
}

// ==================== DRAG AND DROP ====================
function setupDragAndDrop() {
  const draggables = document.querySelectorAll('[draggable="true"]');
  
  draggables.forEach(el => {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
  });
  
  // Make branches droppable
  document.querySelectorAll('.branch-ideas').forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('drop', handleDrop);
    zone.addEventListener('dragleave', handleDragLeave);
  });
  
  // Make hub droppable too (to move back)
  hubIdeasList.addEventListener('dragover', handleDragOver);
  hubIdeasList.addEventListener('drop', handleDropToHub);
  hubIdeasList.addEventListener('dragleave', handleDragLeave);
}

let draggedElement = null;
let draggedIdeaId = null;

function handleDragStart(e) {
  draggedElement = e.target;
  draggedIdeaId = e.target.dataset.ideaId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedElement = null;
  draggedIdeaId = null;
  
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedIdeaId) return;
  
  const branchEl = e.currentTarget.closest('.branch');
  const branchId = branchEl ? branchEl.dataset.branchId : null;
  
  const idea = ideas.find(i => i.id === draggedIdeaId);
  if (idea && branchId) {
    idea.branchId = branchId;
    idea.manuallyMoved = true; // Flag so AI doesn't override
    
    renderHubIdeas();
    renderBranches();
  }
}

function handleDropToHub(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedIdeaId) return;
  
  const idea = ideas.find(i => i.id === draggedIdeaId);
  if (idea) {
    idea.branchId = null;
    idea.manuallyMoved = true;
    
    renderHubIdeas();
    renderBranches();
  }
}

// ==================== BRANCH POPUP ====================
let currentPopupBranchId = null;

function openBranchPopup(branchId) {
  const branch = branches.find(b => b.id === branchId);
  if (!branch) return;
  
  currentPopupBranchId = branchId;
  
  const overlay = document.getElementById('branch-popup-overlay');
  const colorDot = document.getElementById('popup-color-dot');
  const branchName = document.getElementById('popup-branch-name');
  const ideaCount = document.getElementById('popup-idea-count');
  
  // Set header info
  colorDot.style.background = branch.color;
  branchName.textContent = branch.name;
  
  // Render ideas in popup
  renderPopupIdeas(branchId);
  
  // Show popup
  overlay.classList.add('active');
  
  // Focus input
  setTimeout(() => {
    document.getElementById('popup-idea-input').focus();
  }, 300);
}

function closeBranchPopup() {
  const overlay = document.getElementById('branch-popup-overlay');
  overlay.classList.remove('active');
  currentPopupBranchId = null;
}

function renderPopupIdeas(branchId) {
  const branchIdeas = ideas.filter(i => i.branchId === branchId);
  const ideaCount = document.getElementById('popup-idea-count');
  const ideasList = document.getElementById('popup-ideas-list');
  
  ideaCount.textContent = `${branchIdeas.length} idea${branchIdeas.length !== 1 ? 's' : ''}`;
  
  if (branchIdeas.length === 0) {
    ideasList.innerHTML = `
      <div class="popup-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <p>No ideas yet in this category</p>
      </div>
    `;
    return;
  }
  
  ideasList.innerHTML = branchIdeas.map((idea, index) => `
    <div class="popup-idea-item" data-idea-id="${idea.id}">
      <span class="popup-idea-number">${index + 1}</span>
      <div class="popup-idea-content">
        <span class="popup-idea-text" contenteditable="true">${escapeHtml(idea.text)}</span>
      </div>
      <div class="popup-idea-actions">
        <button class="popup-idea-btn delete" onclick="deleteIdeaFromPopup('${idea.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  // Add edit listeners
  ideasList.querySelectorAll('.popup-idea-text').forEach(el => {
    el.addEventListener('blur', (e) => {
      const ideaId = e.target.closest('.popup-idea-item').dataset.ideaId;
      updateIdeaText(ideaId, e.target.textContent.trim());
    });
    
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
  });
}

function addIdeaFromPopup() {
  const input = document.getElementById('popup-idea-input');
  const text = input.value.trim();
  
  if (!text || !currentPopupBranchId) return;
  
  const idea = {
    id: generateId(),
    text: text,
    source: 'manual',
    branchId: currentPopupBranchId,
    createdAt: new Date()
  };
  
  ideas.push(idea);
  input.value = '';
  
  // Re-render popup and branches
  renderPopupIdeas(currentPopupBranchId);
  renderBranches();
  
  showToast('Idea added!', 'success');
}

function deleteIdeaFromPopup(ideaId) {
  const index = ideas.findIndex(i => i.id === ideaId);
  if (index > -1) {
    ideas.splice(index, 1);
    
    // Re-render popup and branches
    if (currentPopupBranchId) {
      renderPopupIdeas(currentPopupBranchId);
    }
    renderBranches();
  }
}

function setupPopupEventListeners() {
  // Close button
  const closeBtn = document.getElementById('popup-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeBranchPopup);
  }
  
  // Click overlay to close
  const overlay = document.getElementById('branch-popup-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeBranchPopup();
      }
    });
  }
  
  // Add button
  const addBtn = document.getElementById('popup-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addIdeaFromPopup);
  }
  
  // Enter to add
  const input = document.getElementById('popup-idea-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addIdeaFromPopup();
      }
    });
  }
  
  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentPopupBranchId) {
      closeBranchPopup();
    }
  });
}

// Make popup functions globally available
window.deleteIdeaFromPopup = deleteIdeaFromPopup;
window.openBranchPopup = openBranchPopup;

// ==================== UTILITIES ====================
function checkOrganizeThreshold() {
  const unbranchedCount = ideas.filter(i => !i.branchId).length;
  
  if (unbranchedCount >= ORGANIZE_THRESHOLD) {
    organizeBtn.style.display = 'flex';
  } else {
    organizeBtn.style.display = 'none';
  }
}

function showSuggestionsLoading() {
  aiSuggestionsList.innerHTML = `
    <div class="suggestions-loading">
      <div class="loading-spinner"></div>
      <span>Generating ideas...</span>
    </div>
  `;
}

function getDefaultSuggestions() {
  return [
    'User authentication with social login',
    'Real-time notifications and alerts',
    'Dashboard with analytics overview',
    'Export data to PDF or CSV',
    'Dark mode and theme customization'
  ];
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function generateId() {
  return 'idea_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Make functions globally available for onclick handlers
window.addSuggestionAsIdea = addSuggestionAsIdea;
window.removeIdea = removeIdea;
