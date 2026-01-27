// Marketplace JavaScript
axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;

// Set up axios interceptor to add authorization header
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    console.log('Axios interceptor - token exists:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    console.error('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// State
let apps = [];
let allApps = []; // Cache all listings for client-side filtering
let allAppsLoaded = false; // Flag to know if we have all data
let currentCategory = 'all';
let currentSort = 'latest';
let searchQuery = '';
let currentUserId = null;
let currentDetailApp = null;
let currentImageIndex = 0;
let userIdeas = [];
let existingAutofill = null;
let uploadedImages = []; // Store base64 images

// Category colors - matching app theme
const categoryColors = {
  'all': { bg: 'rgba(132, 0, 255, 0.15)', color: '#a855f7', border: '#8400ff' },
  'productivity': { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '#3b82f6' },
  'dev-tools': { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '#10b981' },
  'marketing': { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '#f97316' },
  'finance': { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '#22c55e' },
  'design': { bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '#ec4899' },
  'ai-ml': { bg: 'rgba(132, 0, 255, 0.15)', color: '#a855f7', border: '#8400ff' },
  'e-commerce': { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '#f59e0b' },
  'education': { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '#6366f1' },
  'other': { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '#6b7280' }
};

// Pagination state for infinite scroll
const ITEMS_PER_PAGE = 15;
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;
let hasMoreItems = true;

// DOM Elements
const appsGrid = document.querySelector('.js-apps-grid');
const categoryBtns = document.querySelectorAll('.category-btn');
const sortBtns = document.querySelectorAll('.sort-btn');
const searchInput = document.querySelector('.search-input');
const fabButton = document.querySelector('.js-add-app');
const modalOverlay = document.querySelector('.js-modal-overlay');
const modalClose = document.querySelector('.js-modal-close');
const appForm = document.querySelector('.js-app-form');
const detailOverlay = document.querySelector('.js-detail-overlay');
const detailClose = document.querySelector('.js-detail-close');
const detailContent = document.querySelector('.js-detail-content');
const imageDropzone = document.querySelector('.js-image-dropzone');
const fileInput = document.querySelector('.js-file-input');
const imagePreviews = document.querySelector('.js-image-previews');
const ideaSelect = document.querySelector('.js-idea-select');
const autofillBtn = document.querySelector('.js-autofill-btn');
const autofillNote = document.querySelector('.js-autofill-note');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  getCurrentUser();
  loadApps(true); // true = fresh load (reset pagination)
  loadUserIdeas();
  setupEventListeners();
  setupInfiniteScroll();
});

// Setup infinite scroll detection
function setupInfiniteScroll() {
  // Use Intersection Observer for better performance than scroll events
  const sentinel = document.createElement('div');
  sentinel.className = 'scroll-sentinel';
  sentinel.id = 'scroll-sentinel';
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && hasMoreItems && !isLoadingMore) {
        loadMoreApps();
      }
    });
  }, {
    root: null,
    rootMargin: '200px', // Start loading 200px before reaching bottom
    threshold: 0
  });
  
  // We'll append the sentinel after rendering apps
  window.scrollSentinelObserver = observer;
}

// Load more apps (next page)
async function loadMoreApps() {
  if (isLoadingMore || !hasMoreItems) return;
  
  isLoadingMore = true;
  currentPage++;
  
  // Show loading indicator at bottom
  const loadingMore = document.createElement('div');
  loadingMore.className = 'loading-more';
  loadingMore.innerHTML = `
    <div class="loading-spinner small"></div>
    <span>Loading more...</span>
  `;
  appsGrid.appendChild(loadingMore);
  
  try {
    const params = new URLSearchParams();
    if (currentCategory !== 'all') params.append('category', currentCategory);
    if (currentSort) params.append('sort', currentSort);
    if (searchQuery) params.append('search', searchQuery);
    params.append('page', currentPage);
    params.append('limit', ITEMS_PER_PAGE);
    
    const response = await axios.get(`/api/marketplace?${params.toString()}`, {
      timeout: 60000
    });
    
    if (response.data.success) {
      const newApps = response.data.listings;
      const pagination = response.data.pagination;
      
      // Update pagination state
      totalPages = pagination.pages;
      hasMoreItems = currentPage < totalPages;
      
      // Append new apps
      apps = [...apps, ...newApps];
      
      // Remove loading indicator
      loadingMore.remove();
      
      // Render only the new apps (append to existing)
      renderNewApps(newApps);
    }
  } catch (error) {
    console.error('Error loading more apps:', error);
    loadingMore.innerHTML = `
      <span style="color: #ef4444;">Error loading more. <a href="#" onclick="loadMoreApps(); return false;">Retry</a></span>
    `;
  } finally {
    isLoadingMore = false;
  }
}

// Render only new apps (for infinite scroll)
function renderNewApps(newApps) {
  // Remove sentinel if exists
  const existingSentinel = document.getElementById('scroll-sentinel');
  if (existingSentinel) existingSentinel.remove();
  
  newApps.forEach(app => {
    const cardHtml = createAppCard(app);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml;
    const card = tempDiv.firstElementChild;
    
    // Add click handler
    card.addEventListener('click', (e) => {
      if (e.target.closest('.upvote-btn')) return;
      openDetailModal(app);
    });
    
    // Add upvote handler
    const upvoteBtn = card.querySelector('.upvote-btn');
    if (upvoteBtn) {
      upvoteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleUpvote(app._id, upvoteBtn);
      });
    }
    
    appsGrid.appendChild(card);
  });
  
  // Re-add sentinel at the end for infinite scroll
  appendScrollSentinel();
}

// Append scroll sentinel to trigger loading more
function appendScrollSentinel() {
  if (!hasMoreItems) return;
  
  let sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    sentinel.id = 'scroll-sentinel';
  }
  appsGrid.appendChild(sentinel);
  
  if (window.scrollSentinelObserver) {
    window.scrollSentinelObserver.observe(sentinel);
  }
}

// Get current user ID
async function getCurrentUser() {
  try {
    const response = await axios.get('/api/users/profile');
    if (response.data && response.data.user) {
      currentUserId = response.data.user._id;
    }
  } catch (error) {
    console.error('Error getting user:', error);
  }
}

// Load user's ideas for autofill dropdown
async function loadUserIdeas() {
  try {
    const response = await axios.get('/api/save/ideas');
    if (response.data && response.data.idea) {
      userIdeas = Array.isArray(response.data.idea) ? response.data.idea : [];
      populateIdeaSelect();
    }
  } catch (error) {
    console.error('Error loading ideas:', error);
  }
}

// Populate idea select dropdown
function populateIdeaSelect() {
  if (!ideaSelect) return;
  
  ideaSelect.innerHTML = '<option value="">Select an idea...</option>';
  
  userIdeas.forEach(idea => {
    const option = document.createElement('option');
    option.value = idea._id;
    option.textContent = idea.ideaName;
    ideaSelect.appendChild(option);
  });
}

// Check if user already has autofill generated for a specific idea
async function checkExistingAutofill(ideaId = null) {
  try {
    const url = ideaId ? `/api/marketplace/autofill?ideaId=${ideaId}` : '/api/marketplace/autofill';
    const response = await axios.get(url);
    if (response.data && response.data.hasAutofill) {
      existingAutofill = response.data.autofill;
      showAutofillNote('Autofill exists for this idea. Click to use it.', 'info');
      if (autofillBtn) {
        autofillBtn.disabled = false;
        autofillBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Use Saved
        `;
      }
      return true;
    } else {
      existingAutofill = null;
      return false;
    }
  } catch (error) {
    console.error('Error checking autofill:', error);
    existingAutofill = null;
    return false;
  }
}

// Show autofill note
function showAutofillNote(message, type) {
  if (!autofillNote) return;
  autofillNote.textContent = message;
  autofillNote.className = `autofill-note js-autofill-note ${type}`;
}

// Hide autofill note
function hideAutofillNote() {
  if (!autofillNote) return;
  autofillNote.classList.add('hidden');
}

// Apply category colors to filter buttons
function applyCategoryButtonColors() {
  categoryBtns.forEach(btn => {
    const category = btn.dataset.category;
    const catColor = categoryColors[category] || categoryColors['all'];
    
    if (btn.classList.contains('active')) {
      btn.style.background = catColor.color;
      btn.style.borderColor = catColor.color;
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.borderColor = '#333';
      btn.style.color = '#ccc';
    }
    
    // Hover effect
    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) {
        btn.style.borderColor = catColor.color;
        btn.style.color = catColor.color;
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('active')) {
        btn.style.borderColor = '#333';
        btn.style.color = '#ccc';
      }
    });
  });
}

// Event Listeners
function setupEventListeners() {
  // Apply initial category colors to buttons
  applyCategoryButtonColors();
  
  // Category filter
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = '#333';
        b.style.color = '#ccc';
      });
      btn.classList.add('active');
      const catColor = categoryColors[btn.dataset.category] || categoryColors['all'];
      btn.style.background = catColor.color;
      btn.style.borderColor = catColor.color;
      btn.style.color = '#fff';
      currentCategory = btn.dataset.category;
      applyFilters(); // Client-side filtering - instant!
    });
  });

  // Sort tabs
  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      applyFilters(); // Client-side sorting - instant!
    });
  });

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase();
      applyFilters(); // Client-side search - instant!
    }, 150); // Reduced debounce since it's instant now
  });

  // FAB button - open modal
  fabButton.addEventListener('click', () => {
    resetUploadedImages();
    modalOverlay.classList.remove('hidden');
  });

  // Close modal
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Close detail modal
  detailClose.addEventListener('click', closeDetailModal);
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) {
      closeDetailModal();
    }
  });

  // Form submit
  appForm.addEventListener('submit', handleSubmit);

  // Image dropzone events
  setupImageDropzone();

  // Idea select for autofill
  if (ideaSelect) {
    ideaSelect.addEventListener('change', async () => {
      const selectedIdeaId = ideaSelect.value;
      const hasSelection = selectedIdeaId !== '';
      
      if (hasSelection) {
        // Check if this specific idea has an existing autofill
        hideAutofillNote();
        if (autofillBtn) {
          autofillBtn.disabled = true;
          autofillBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Checking...
          `;
        }
        
        const hasExisting = await checkExistingAutofill(selectedIdeaId);
        
        if (!hasExisting && autofillBtn) {
          // No existing autofill for this idea - allow generation
          existingAutofill = null;
          autofillBtn.disabled = false;
          autofillBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Generate
          `;
          hideAutofillNote();
        }
      } else {
        // No idea selected
        existingAutofill = null;
        if (autofillBtn) {
          autofillBtn.disabled = true;
          autofillBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Generate
          `;
        }
        hideAutofillNote();
      }
    });
  }

  // Autofill button
  if (autofillBtn) {
    autofillBtn.addEventListener('click', handleAutofill);
  }

  // Close modals on escape + arrow keys for gallery
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modalOverlay.classList.contains('hidden')) {
        closeModal();
      }
      if (!detailOverlay.classList.contains('hidden')) {
        closeDetailModal();
      }
    }
    // Arrow keys for image gallery
    if (!detailOverlay.classList.contains('hidden') && currentDetailApp) {
      if (e.key === 'ArrowLeft') {
        navigateImage(-1);
      } else if (e.key === 'ArrowRight') {
        navigateImage(1);
      }
    }
  });
}

// Setup image dropzone
function setupImageDropzone() {
  if (!imageDropzone || !fileInput) return;
  
  // Click to open file picker
  imageDropzone.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
  
  // Drag and drop events
  imageDropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    imageDropzone.classList.add('drag-over');
  });
  
  imageDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropzone.classList.add('drag-over');
  });
  
  imageDropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    imageDropzone.classList.remove('drag-over');
  });
  
  imageDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropzone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

// Handle dropped/selected files
function handleFiles(files) {
  const remainingSlots = 5 - uploadedImages.length;
  const filesToProcess = Array.from(files).slice(0, remainingSlots);
  
  if (files.length > remainingSlots) {
    alert(`You can only upload up to 5 images. ${files.length - remainingSlots} file(s) were not added.`);
  }
  
  filesToProcess.forEach(file => {
    if (!file.type.startsWith('image/')) {
      alert(`${file.name} is not an image file.`);
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(`${file.name} is too large. Max size is 5MB.`);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      uploadedImages.push(base64);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

// Render image previews
function renderImagePreviews() {
  if (!imagePreviews) return;
  
  imagePreviews.innerHTML = uploadedImages.map((img, idx) => `
    <div class="image-preview" data-index="${idx}">
      <img src="${img}" alt="Preview ${idx + 1}"/>
      <button type="button" class="image-preview-remove" data-index="${idx}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Add remove handlers
  document.querySelectorAll('.image-preview-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      uploadedImages.splice(index, 1);
      renderImagePreviews();
    });
  });
}

// Reset uploaded images
function resetUploadedImages() {
  uploadedImages = [];
  if (imagePreviews) {
    imagePreviews.innerHTML = '';
  }
  if (fileInput) {
    fileInput.value = '';
  }
}

// Handle AI Autofill
async function handleAutofill() {
  // If we have existing autofill cached, use it directly
  if (existingAutofill) {
    applyAutofill(existingAutofill);
    showAutofillNote('Using your saved autofill data.', 'info');
    return;
  }
  
  const selectedIdeaId = ideaSelect.value;
  if (!selectedIdeaId) {
    showAutofillNote('Please select an idea first.', 'error');
    return;
  }
  
  // Show loading state
  autofillBtn.classList.add('loading');
  autofillBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    Generating...
  `;
  autofillBtn.disabled = true;
  hideAutofillNote();
  
  try {
    const response = await axios.post('/api/marketplace/autofill', {
      ideaId: selectedIdeaId
    });
    
    if (response.data.success) {
      existingAutofill = response.data.autofill;
      applyAutofill(response.data.autofill);
      
      if (response.data.cached) {
        showAutofillNote('Using your previously saved autofill.', 'info');
      } else {
        showAutofillNote('Form filled! Review and add your app URL & images.', 'success');
      }
      
      // Update button to show it's been used
      autofillBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Applied
      `;
      autofillBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error generating autofill:', error);
    showAutofillNote(error.response?.data?.message || 'Error generating autofill. Please try again.', 'error');
    
    // Reset button
    autofillBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Generate
    `;
    autofillBtn.disabled = false;
  } finally {
    autofillBtn.classList.remove('loading');
  }
}

// Apply autofill data to form
function applyAutofill(data) {
  if (!data) return;
  
  // Fill in form fields
  const nameInput = document.getElementById('app-name');
  const taglineInput = document.getElementById('app-tagline');
  const descriptionInput = document.getElementById('app-description');
  const categorySelect = document.getElementById('app-category');
  
  if (nameInput && data.name) {
    nameInput.value = data.name;
  }
  if (taglineInput && data.tagline) {
    taglineInput.value = data.tagline;
  }
  if (descriptionInput && data.description) {
    descriptionInput.value = data.description;
  }
  if (categorySelect && data.category) {
    categorySelect.value = data.category;
  }
  
  // Highlight filled fields briefly
  [nameInput, taglineInput, descriptionInput, categorySelect].forEach(el => {
    if (el && el.value) {
      el.style.borderColor = '#8400ff';
      setTimeout(() => {
        el.style.borderColor = '';
      }, 2000);
    }
  });
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  appForm.reset();
  resetUploadedImages();
}

function closeDetailModal() {
  detailOverlay.classList.add('hidden');
  document.body.style.overflow = ''; // Restore scroll
  currentDetailApp = null;
  currentImageIndex = 0;
}

// Lazy loading for images using Intersection Observer
function initLazyLoading() {
  const lazyImages = document.querySelectorAll('.lazy-image');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.add('loaded');
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '100px', // Load images 100px before they enter viewport
      threshold: 0.01
    });
    
    lazyImages.forEach(img => {
      if (!img.src || img.src === window.location.href) {
        imageObserver.observe(img);
      }
    });
  } else {
    // Fallback for browsers without IntersectionObserver
    lazyImages.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  }
}

// Client-side filtering and sorting functions
function filterAndSortApps() {
  let filtered = [...allApps];
  
  // Category filter
  if (currentCategory !== 'all') {
    filtered = filtered.filter(app => app.category === currentCategory);
  }
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(app => 
      app.name.toLowerCase().includes(query) ||
      app.tagline.toLowerCase().includes(query) ||
      (app.description && app.description.toLowerCase().includes(query)) ||
      app.category.toLowerCase().includes(query)
    );
  }
  
  // Sort
  switch (currentSort) {
    case 'trending':
      // Sort by recent upvotes (use recentUpvotes if available, else upvotes)
      filtered.sort((a, b) => (b.recentUpvotes || b.upvotes || 0) - (a.recentUpvotes || a.upvotes || 0));
      break;
    case 'hall-of-fame':
      // Sort by total upvotes
      filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      break;
    case 'latest':
    default:
      // Sort by creation date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  return filtered;
}

// Apply filters client-side (fast, no API call)
function applyFilters() {
  if (!allAppsLoaded) {
    // If we haven't loaded all apps yet, do a server load
    loadApps(true);
    return;
  }
  
  // Client-side filtering - instant!
  apps = filterAndSortApps();
  renderApps();
}

// Load ALL apps from backend once, then filter client-side
async function loadApps(freshLoad = true) {
  console.log('loadApps() called, freshLoad:', freshLoad);
  
  // If we already have all apps cached, just filter client-side
  if (allAppsLoaded && freshLoad) {
    apps = filterAndSortApps();
    renderApps();
    return;
  }
  
  // Reset pagination state on fresh load
  if (freshLoad) {
    currentPage = 1;
    hasMoreItems = true;
    apps = [];
  }
  
  // Show loading state
  appsGrid.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading apps...</p>
    </div>
  `;
  
  try {
    // Load ALL listings at once (no filters, let client handle it)
    // Use a high limit to get all listings in one request
    const params = new URLSearchParams();
    params.append('limit', 500); // Get up to 500 listings at once
    params.append('page', 1);
    
    console.log('Loading all apps from server...');
    
    const response = await axios.get(`/api/marketplace?${params.toString()}`, {
      timeout: 60000
    });
    
    console.log('Apps loaded:', response.data);
    
    if (response.data.success) {
      // Cache all apps
      allApps = response.data.listings;
      allAppsLoaded = true;
      
      // Apply current filters
      apps = filterAndSortApps();
      
      // No pagination needed for client-side filtering
      hasMoreItems = false;
      
      console.log(`Loaded ${allApps.length} total apps, ${apps.length} after filtering`);
      
      renderApps();
    } else {
      throw new Error('Failed to load apps');
    }
  } catch (error) {
    console.error('Error loading apps:', error);
    apps = [];
    appsGrid.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <h3>Error loading apps</h3>
        <p>${error.message || 'Please try refreshing the page.'}</p>
      </div>
    `;
  }
}

// Render apps
function renderApps() {
  if (apps.length === 0) {
    appsGrid.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <h3>${searchQuery ? 'No apps found' : 'No apps yet'}</h3>
        <p>${searchQuery ? 'Try a different search term' : 'Be the first to share your creation with the community!'}</p>
      </div>
    `;
    return;
  }

  appsGrid.innerHTML = apps.map(app => createAppCard(app)).join('');

  // Initialize lazy loading for images
  initLazyLoading();

  // Add click handlers for app cards
  document.querySelectorAll('.app-card').forEach((card) => {
    const appId = card.dataset.appId;
    const app = apps.find(a => a._id === appId);
    
    card.addEventListener('click', (e) => {
      // Don't open detail if clicking upvote button
      if (e.target.closest('.upvote-btn')) return;
      
      openDetailModal(app);
    });
  });

  // Add upvote handlers
  document.querySelectorAll('.upvote-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const appId = btn.dataset.appId;
      await handleUpvote(appId, btn);
    });
  });
  
  // Append scroll sentinel for infinite scroll
  appendScrollSentinel();
}

// Create app card HTML
function createAppCard(app) {
  // Use thumbnail from backend (first image extracted server-side for performance)
  const thumbnailUrl = app.thumbnail || null;

  const categoryLabel = app.category.replace('-', ' ');
  const isUpvoted = app.upvotedBy && app.upvotedBy.includes(currentUserId);
  const catColor = categoryColors[app.category] || categoryColors['other'];

  return `
    <div class="app-card" data-app-id="${app._id}">
      <div class="app-card-image">
        ${thumbnailUrl ? `<img data-src="${thumbnailUrl}" alt="${app.name}" class="lazy-image" onerror="this.style.display='none'"/>` : `<div class="app-card-placeholder">${app.name.charAt(0).toUpperCase()}</div>`}
      </div>
      <div class="app-card-body">
        <h3 class="app-name">${escapeHtml(app.name)}</h3>
        <p class="app-tagline">${escapeHtml(app.tagline)}</p>
        <span class="app-category" style="background: ${catColor.bg}; color: ${catColor.color};">${escapeHtml(categoryLabel)}</span>
      </div>
      <div class="app-card-footer">
        <div class="app-stats">
          <button class="upvote-btn ${isUpvoted ? 'upvoted' : ''}" data-app-id="${app._id}">
            <svg viewBox="0 0 24 24" fill="${isUpvoted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span class="upvote-count">${app.upvotes || 0}</span>
          </button>
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            ${app.views || 0}
          </span>
        </div>
        <span class="app-author">by <span>${escapeHtml(app.authorName || 'Anonymous')}</span></span>
      </div>
    </div>
  `;
}

// Open detail modal
async function openDetailModal(app) {
  // Show loading state in modal
  detailOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent background scroll
  
  detailContent.innerHTML = `
    <div class="detail-loading">
      <div class="loading-spinner"></div>
      <p>Loading details...</p>
    </div>
  `;
  
  try {
    // Fetch full listing data with all images
    const response = await axios.get(`/api/marketplace/${app._id}`);
    if (!response.data.success) {
      throw new Error('Failed to load listing');
    }
    
    const fullApp = response.data.listing;
    currentDetailApp = fullApp;
    currentImageIndex = 0;
    
    const categoryLabel = fullApp.category.replace('-', ' ');
    const isUpvoted = fullApp.upvotedBy && fullApp.upvotedBy.includes(currentUserId);
    const hasMultipleImages = fullApp.images && fullApp.images.length > 1;
    const hasImages = fullApp.images && fullApp.images.length > 0;
    
    detailContent.innerHTML = `
      <!-- Header Section -->
      <div class="detail-top-header">
        <div class="detail-title-section">
          <h1 class="detail-app-name">${escapeHtml(fullApp.name)}</h1>
          <span class="detail-category-badge">${escapeHtml(categoryLabel)}</span>
        </div>
        <div class="detail-header-actions">
          <span class="detail-author-info">By <strong>${escapeHtml(fullApp.authorName || 'Anonymous')}</strong></span>
          <a href="${fullApp.appUrl}" target="_blank" rel="noopener" class="detail-visit-btn">
            <span>Visit App</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      </div>
      
      <!-- Section Navigation Bar -->
      <nav class="detail-section-nav">
        <button class="section-nav-btn active" data-target="section-screenshots">Screenshots</button>
        <button class="section-nav-btn" data-target="section-description">Description</button>
        <button class="section-nav-btn" data-target="section-details">Details</button>
        <button class="section-nav-btn" data-target="section-community">Community</button>
        <button class="section-nav-btn" data-target="section-reviews">Reviews</button>
      </nav>
      
      <!-- Scrollable Content -->
      <div class="detail-scroll-content js-detail-scroll">
        <!-- Image Gallery -->
        <div id="section-screenshots" class="detail-section">
          ${hasImages ? `
            <div class="detail-image-gallery">
              <div class="gallery-main-container">
                ${hasMultipleImages ? `
                  <button class="gallery-arrow gallery-arrow-prev js-gallery-prev">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                ` : ''}
                <img class="gallery-main-image js-gallery-image" src="${fullApp.images[0]}" alt="${fullApp.name}"/>
                ${hasMultipleImages ? `
                  <button class="gallery-arrow gallery-arrow-next js-gallery-next">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                  <div class="gallery-image-counter js-gallery-counter">1 / ${fullApp.images.length}</div>
                ` : ''}
              </div>
              ${hasMultipleImages ? `
                <div class="gallery-thumbnail-strip js-gallery-thumbnails">
                  ${fullApp.images.map((img, idx) => `
                    <img class="gallery-thumbnail ${idx === 0 ? 'active' : ''}" src="${img}" alt="Screenshot ${idx + 1}" data-index="${idx}"/>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="detail-no-image">
              <div class="no-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>No screenshots available</span>
              </div>
            </div>
          `}
        </div>
        
        <!-- Description Section -->
        <div id="section-description" class="detail-section">
          <h3 class="detail-section-title section-title-purple">Description</h3>
          <div class="detail-section-content">
            ${fullApp.description ? `<p class="detail-description-text">${escapeHtml(fullApp.description)}</p>` : '<p class="detail-no-content">No description provided.</p>'}
          </div>
        </div>
        
        <!-- App Details Section -->
        <div id="section-details" class="detail-section">
          <h3 class="detail-section-title section-title-orange">Details</h3>
          <div class="detail-info-grid">
            <div class="detail-info-item">
              <span class="detail-info-label">Category</span>
              <span class="detail-info-value">${escapeHtml(categoryLabel)}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-info-label">Created by</span>
              <span class="detail-info-value">${escapeHtml(fullApp.authorName || 'Anonymous')}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-info-label">Published</span>
              <span class="detail-info-value">${formatDate(fullApp.createdAt)}</span>
            </div>
            <div class="detail-info-item">
              <span class="detail-info-label">Views</span>
              <span class="detail-info-value">${fullApp.views || 0}</span>
            </div>
          </div>
        </div>
        
        <!-- Stats & Actions Section -->
        <div id="section-community" class="detail-section">
          <h3 class="detail-section-title section-title-blue">Community</h3>
          <div class="detail-community-stats">
            <button class="detail-upvote-button ${isUpvoted ? 'upvoted' : ''}" data-app-id="${fullApp._id}">
              <svg viewBox="0 0 24 24" fill="${isUpvoted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              <span class="upvote-count">${fullApp.upvotes || 0}</span>
              <span>Upvotes</span>
            </button>
            <div class="detail-stat-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>${fullApp.views || 0} views</span>
            </div>
          </div>
        </div>
        
        <!-- Reviews Section -->
        <div id="section-reviews" class="detail-section">
          <h3 class="detail-section-title section-title-pink">
            Reviews
            <span class="review-summary-badge">
              ${fullApp.reviewCount > 0 ? `
                <span class="average-rating">${fullApp.averageRating || 0}</span>
                <span class="rating-stars">${renderStars(fullApp.averageRating || 0)}</span>
                <span class="review-count">(${fullApp.reviewCount || 0})</span>
              ` : '<span class="no-reviews-yet">No reviews yet</span>'}
            </span>
          </h3>
          
          <!-- Review Form -->
          <div class="review-form-container" data-listing-id="${fullApp._id}">
            <h4 class="review-form-title">Write a Review</h4>
            <div class="star-rating-input">
              <span class="star-label">Your Rating:</span>
              <div class="star-input-group">
                ${[1,2,3,4,5].map(n => `
                  <button type="button" class="star-input-btn" data-rating="${n}" title="${n} star${n > 1 ? 's' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                `).join('')}
              </div>
            </div>
            <textarea class="review-comment-input" placeholder="Share your experience with this app... (optional)" maxlength="1000"></textarea>
            <div class="review-form-actions">
              <span class="char-counter">0 / 1000</span>
              <button class="submit-review-btn" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Submit Review
              </button>
            </div>
          </div>
          
          <!-- Reviews List -->
          <div class="reviews-list-container" data-listing-id="${fullApp._id}">
            <div class="reviews-header">
              <div class="reviews-sort">
                <label>Sort by:</label>
                <select class="reviews-sort-select">
                  <option value="recent">Most Recent</option>
                  <option value="helpful">Most Helpful</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                </select>
              </div>
            </div>
            <div class="reviews-list js-reviews-list">
              <div class="reviews-loading">
                <div class="loading-spinner"></div>
                <span>Loading reviews...</span>
              </div>
            </div>
            <button class="load-more-reviews-btn" style="display: none;">Load More Reviews</button>
          </div>
        </div>
      </div>
    `;
    
    // Add event handlers
    setupDetailModalHandlers(fullApp);
    
    // Load reviews
    loadReviews(fullApp._id);
    
  } catch (error) {
    console.error('Error loading listing details:', error);
    detailContent.innerHTML = `
      <div class="detail-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3>Error loading details</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}

// Setup event handlers for detail modal
function setupDetailModalHandlers(app) {
  // Section navigation
  const navBtns = detailContent.querySelectorAll('.section-nav-btn');
  const scrollContainer = detailContent.querySelector('.js-detail-scroll');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetSection = document.getElementById(targetId);
      
      if (targetSection && scrollContainer) {
        // Update active state
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Smooth scroll to section
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  
  // Update active nav on scroll
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      const sections = scrollContainer.querySelectorAll('.detail-section[id]');
      let currentSection = '';
      
      sections.forEach(section => {
        const sectionTop = section.offsetTop - scrollContainer.offsetTop;
        if (scrollContainer.scrollTop >= sectionTop - 100) {
          currentSection = section.id;
        }
      });
      
      navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === currentSection);
      });
    });
  }
  
  // Gallery navigation
  const prevBtn = detailContent.querySelector('.js-gallery-prev');
  const nextBtn = detailContent.querySelector('.js-gallery-next');
  const thumbnails = detailContent.querySelectorAll('.gallery-thumbnail');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigateImage(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateImage(1));
  }
  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', () => {
      goToImage(parseInt(thumb.dataset.index));
    });
  });
  
  // Upvote button
  const upvoteBtn = detailContent.querySelector('.detail-upvote-button');
  if (upvoteBtn) {
    upvoteBtn.addEventListener('click', async () => {
      await handleUpvote(app._id, upvoteBtn);
    });
  }
  
  // Review form handlers
  setupReviewFormHandlers(app._id);
}

// Setup review form event handlers
function setupReviewFormHandlers(listingId) {
  const formContainer = document.querySelector('.review-form-container');
  if (!formContainer) return;
  
  let selectedRating = 0;
  const starBtns = formContainer.querySelectorAll('.star-input-btn');
  const commentInput = formContainer.querySelector('.review-comment-input');
  const submitBtn = formContainer.querySelector('.submit-review-btn');
  const charCounter = formContainer.querySelector('.char-counter');
  const sortSelect = document.querySelector('.reviews-sort-select');
  const loadMoreBtn = document.querySelector('.load-more-reviews-btn');
  
  // Star rating input
  starBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const rating = parseInt(btn.dataset.rating);
      highlightStars(rating);
    });
    
    btn.addEventListener('mouseleave', () => {
      highlightStars(selectedRating);
    });
    
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.rating);
      highlightStars(selectedRating);
      updateSubmitButton();
    });
  });
  
  function highlightStars(rating) {
    starBtns.forEach(btn => {
      const starRating = parseInt(btn.dataset.rating);
      const svg = btn.querySelector('svg');
      if (starRating <= rating) {
        svg.setAttribute('fill', 'currentColor');
        btn.classList.add('selected');
      } else {
        svg.setAttribute('fill', 'none');
        btn.classList.remove('selected');
      }
    });
  }
  
  // Character counter
  if (commentInput) {
    commentInput.addEventListener('input', () => {
      const count = commentInput.value.length;
      charCounter.textContent = `${count} / 1000`;
    });
  }
  
  // Update submit button state
  function updateSubmitButton() {
    submitBtn.disabled = selectedRating === 0;
  }
  
  // Submit review
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (selectedRating === 0) return;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="btn-spinner"></div> Submitting...';
      
      try {
        const response = await axios.post(`/api/marketplace/${listingId}/reviews`, {
          rating: selectedRating,
          comment: commentInput.value.trim()
        });
        
        if (response.data.success) {
          // Reset form
          selectedRating = 0;
          highlightStars(0);
          commentInput.value = '';
          charCounter.textContent = '0 / 1000';
          
          // Update badge
          updateReviewBadge(response.data.averageRating, response.data.reviewCount);
          
          // Reload reviews
          loadReviews(listingId, true);
          
          submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Submit Review
          `;
        }
      } catch (error) {
        console.error('Error submitting review:', error);
        const message = error.response?.data?.message || 'Failed to submit review';
        alert(message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Submit Review
        `;
      }
    });
  }
  
  // Sort reviews
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentReviewSort = sortSelect.value;
      loadReviews(listingId, true);
    });
  }
  
  // Load more reviews
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      currentReviewPage++;
      loadReviews(listingId, false);
    });
  }
}

// Navigate gallery images
function navigateImage(direction) {
  if (!currentDetailApp || !currentDetailApp.images) return;
  
  const totalImages = currentDetailApp.images.length;
  currentImageIndex = (currentImageIndex + direction + totalImages) % totalImages;
  
  updateGalleryImage();
}

// Go to specific image
function goToImage(index) {
  currentImageIndex = index;
  updateGalleryImage();
}

// Update gallery display
function updateGalleryImage() {
  if (!currentDetailApp) return;
  
  const mainImage = document.querySelector('.js-gallery-image');
  const counter = document.querySelector('.js-gallery-counter');
  const thumbnails = document.querySelectorAll('.gallery-thumbnail');
  
  if (mainImage) {
    mainImage.src = currentDetailApp.images[currentImageIndex];
  }
  
  if (counter) {
    counter.textContent = `${currentImageIndex + 1} / ${currentDetailApp.images.length}`;
  }
  
  thumbnails.forEach((thumb, idx) => {
    thumb.classList.toggle('active', idx === currentImageIndex);
  });
}

// Make navigation functions global for onclick handlers
window.navigateImage = navigateImage;
window.goToImage = goToImage;

// Handle upvote
async function handleUpvote(appId, btn) {
  try {
    const response = await axios.post(`/api/marketplace/${appId}/upvote`);
    
    if (response.data.success) {
      // Update button UI
      const countEl = btn.querySelector('.upvote-count');
      countEl.textContent = response.data.upvotes;
      
      if (response.data.upvoted) {
        btn.classList.add('upvoted');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
      } else {
        btn.classList.remove('upvoted');
        btn.querySelector('svg').setAttribute('fill', 'none');
      }
      
      // Update local data
      const app = apps.find(a => a._id === appId);
      if (app) {
        app.upvotes = response.data.upvotes;
        if (response.data.upvoted) {
          app.upvotedBy = app.upvotedBy || [];
          app.upvotedBy.push(currentUserId);
        } else {
          app.upvotedBy = (app.upvotedBy || []).filter(id => id !== currentUserId);
        }
      }
      
      // Also update cards in grid (sync with detail modal)
      const cardBtn = document.querySelector(`.app-card[data-app-id="${appId}"] .upvote-btn`);
      if (cardBtn && cardBtn !== btn) {
        const cardCountEl = cardBtn.querySelector('.upvote-count');
        cardCountEl.textContent = response.data.upvotes;
        if (response.data.upvoted) {
          cardBtn.classList.add('upvoted');
          cardBtn.querySelector('svg').setAttribute('fill', 'currentColor');
        } else {
          cardBtn.classList.remove('upvoted');
          cardBtn.querySelector('svg').setAttribute('fill', 'none');
        }
      }
    }
  } catch (error) {
    console.error('Error upvoting:', error);
  }
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault();
  
  // Use uploaded images (base64)
  if (uploadedImages.length === 0) {
    alert('At least one image is required');
    return;
  }
  
  const formData = new FormData(appForm);
  const appData = {
    name: formData.get('appName'),
    tagline: formData.get('tagline'),
    appUrl: formData.get('appUrl'),
    category: formData.get('category'),
    description: formData.get('description'),
    images: uploadedImages
  };

  try {
    const response = await axios.post('/api/marketplace', appData);
    
    if (response.data.success) {
      // Add to beginning of list
      apps.unshift(response.data.listing);
      renderApps();
      closeModal();
    }
  } catch (error) {
    console.error('Error submitting app:', error);
    alert(error.response?.data?.message || 'Error submitting app. Please try again.');
  }
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Utility: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Render star rating HTML
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  let html = '';
  
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      html += '<svg class="star filled" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    } else if (i === fullStars + 1 && hasHalf) {
      html += '<svg class="star half" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><defs><linearGradient id="half-fill"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#half-fill)"/></svg>';
    } else {
      html += '<svg class="star empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
  }
  return html;
}

// Load reviews for a listing
let currentReviewPage = 1;
let currentReviewSort = 'recent';
let allReviewsLoaded = false;

async function loadReviews(listingId, reset = true) {
  const reviewsList = document.querySelector('.js-reviews-list');
  const loadMoreBtn = document.querySelector('.load-more-reviews-btn');
  
  if (!reviewsList) return;
  
  if (reset) {
    currentReviewPage = 1;
    allReviewsLoaded = false;
    reviewsList.innerHTML = '<div class="reviews-loading"><div class="loading-spinner"></div><span>Loading reviews...</span></div>';
  }
  
  try {
    const response = await axios.get(`/api/marketplace/${listingId}/reviews`, {
      params: { page: currentReviewPage, limit: 5, sort: currentReviewSort }
    });
    
    if (response.data.success) {
      const { reviews, pagination, averageRating, reviewCount } = response.data;
      
      if (reset) {
        reviewsList.innerHTML = '';
      }
      
      if (reviews.length === 0 && currentReviewPage === 1) {
        reviewsList.innerHTML = `
          <div class="no-reviews-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No reviews yet</p>
            <span>Be the first to share your experience!</span>
          </div>
        `;
        loadMoreBtn.style.display = 'none';
        return;
      }
      
      // Append reviews
      reviews.forEach(review => {
        reviewsList.insertAdjacentHTML('beforeend', createReviewCard(review, listingId));
      });
      
      // Show/hide load more button
      if (currentReviewPage >= pagination.pages) {
        allReviewsLoaded = true;
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'block';
      }
      
      // Attach helpful button handlers
      attachReviewHandlers(listingId);
    }
  } catch (error) {
    console.error('Error loading reviews:', error);
    if (reset) {
      reviewsList.innerHTML = '<div class="reviews-error">Failed to load reviews. Please try again.</div>';
    }
  }
}

// Create review card HTML
function createReviewCard(review, listingId) {
  const isHelpful = review.helpfulBy && review.helpfulBy.includes(currentUserId);
  const isOwner = review.userId === currentUserId;
  const timeAgo = getTimeAgo(new Date(review.createdAt));
  
  return `
    <div class="review-card" data-review-id="${review._id}">
      <div class="review-header">
        <div class="review-user">
          <div class="review-avatar">${review.userName.charAt(0).toUpperCase()}</div>
          <div class="review-user-info">
            <span class="review-user-name">${escapeHtml(review.userName)}</span>
            <span class="review-date">${timeAgo}</span>
          </div>
        </div>
        <div class="review-rating">
          ${renderStars(review.rating)}
        </div>
      </div>
      ${review.comment ? `<p class="review-comment">${escapeHtml(review.comment)}</p>` : ''}
      <div class="review-actions">
        <button class="helpful-btn ${isHelpful ? 'active' : ''}" data-review-id="${review._id}" data-listing-id="${listingId}">
          <svg viewBox="0 0 24 24" fill="${isHelpful ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          <span class="helpful-count">${review.helpful || 0}</span> Helpful
        </button>
        ${isOwner ? `
          <button class="delete-review-btn" data-review-id="${review._id}" data-listing-id="${listingId}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [name, secondsInInterval] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInInterval);
    if (interval >= 1) {
      return `${interval} ${name}${interval > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

// Attach event handlers for reviews
function attachReviewHandlers(listingId) {
  // Helpful buttons
  document.querySelectorAll('.helpful-btn').forEach(btn => {
    btn.onclick = async () => {
      const reviewId = btn.dataset.reviewId;
      const listingId = btn.dataset.listingId;
      
      try {
        const response = await axios.post(`/api/marketplace/${listingId}/reviews/${reviewId}/helpful`);
        if (response.data.success) {
          const countSpan = btn.querySelector('.helpful-count');
          countSpan.textContent = response.data.helpful;
          btn.classList.toggle('active', response.data.isHelpful);
          btn.querySelector('svg').setAttribute('fill', response.data.isHelpful ? 'currentColor' : 'none');
        }
      } catch (error) {
        console.error('Error marking helpful:', error);
      }
    };
  });
  
  // Delete buttons
  document.querySelectorAll('.delete-review-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Are you sure you want to delete your review?')) return;
      
      const reviewId = btn.dataset.reviewId;
      const listingId = btn.dataset.listingId;
      
      try {
        const response = await axios.delete(`/api/marketplace/${listingId}/reviews/${reviewId}`);
        if (response.data.success) {
          const card = btn.closest('.review-card');
          card.remove();
          
          // Update header badge
          updateReviewBadge(response.data.averageRating, response.data.reviewCount);
          
          // Check if no reviews left
          const reviewsList = document.querySelector('.js-reviews-list');
          if (reviewsList && reviewsList.children.length === 0) {
            loadReviews(listingId, true);
          }
        }
      } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete review');
      }
    };
  });
}

// Update review summary badge
function updateReviewBadge(averageRating, reviewCount) {
  const badge = document.querySelector('.review-summary-badge');
  if (badge) {
    if (reviewCount > 0) {
      badge.innerHTML = `
        <span class="average-rating">${averageRating}</span>
        <span class="rating-stars">${renderStars(averageRating)}</span>
        <span class="review-count">(${reviewCount})</span>
      `;
    } else {
      badge.innerHTML = '<span class="no-reviews-yet">No reviews yet</span>';
    }
  }
}
