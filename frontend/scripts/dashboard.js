// Dashboard - AI Co-Founder Command Center

// SVG Icons (no emojis)
const ICONS = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  score: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  research: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  action: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  brainstorm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.3 6.4 5.5 7.5.3.1.5.4.5.7V20h4v-1.8c0-.3.2-.6.5-.7C17.7 16.4 20 13.5 20 10a8 8 0 0 0-8-8z"/><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m19.07 4.93-2.83 2.83"/></svg>`,
  idea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

document.addEventListener('DOMContentLoaded', async () => {
  // Get the idea ID - sidebar stores it as JSON string with 'ideaId' key
  let ideaId = localStorage.getItem('ideaId');
  
  // Parse if it's a JSON string (sidebar stores it with JSON.stringify)
  if (ideaId) {
    try {
      ideaId = JSON.parse(ideaId);
    } catch (e) {
      // Already a plain string, use as-is
    }
  }
  
  if (!ideaId) {
    showNoIdeaState();
    return;
  }

  // Load dashboard data and AI insights
  await Promise.all([
    loadDashboardData(ideaId),
    loadAIInsights(ideaId)
  ]);
});

// ======================
// NO IDEA STATE
// ======================

function showNoIdeaState() {
  renderGreeting('Welcome to CoSparq', 'Your AI co-founder is ready to help you build something amazing.');
  renderFocus('Start by creating your first idea');
  
  const ideaContent = document.getElementById('ideaContent');
  if (ideaContent) {
    ideaContent.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <p style="margin-bottom: 16px;">No idea selected yet</p>
        <a href="/idea-page.html" class="btn btn-primary btn-sm">Create Your First Idea</a>
      </div>
    `;
  }
  
  const scoreRingContainer = document.querySelector('.score-ring-container');
  const metricsListEl = document.querySelector('.metrics-list');
  const noScoreEl = document.getElementById('noScoreMessage');
  if (scoreRingContainer) scoreRingContainer.classList.add('hidden');
  if (metricsListEl) metricsListEl.classList.add('hidden');
  if (noScoreEl) noScoreEl.classList.remove('hidden');
  
  renderQuickActions(null);
  
  const recListEl = document.getElementById('recommendationsList');
  if (recListEl) {
    recListEl.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <p>Create an idea to get personalized recommendations</p>
      </div>
    `;
  }
  
  const activityListEl = document.getElementById('activityList');
  if (activityListEl) {
    activityListEl.innerHTML = `
      <div class="no-activity">
        <p>No activity yet. Start by creating an idea!</p>
      </div>
    `;
  }
  
  renderAnalytics({ ideaAge: 0, totalChats: 0, totalTasks: 0, completedTasks: 0 });
  
  renderQuote({
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  });
}

// ======================
// LOAD DASHBOARD DATA
// ======================

async function loadDashboardData(ideaId) {
  const token = localStorage.getItem('accessToken');
  
  try {
    const response = await axios.get(`/api/dashboard/${ideaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = response.data;
    console.log('Dashboard data:', data);

    // Render all sections with correct property names from backend
    renderIdeaSummary(data.idea);
    renderScoreRing(data.scoreboard);
    renderMetrics(data.scoreboard);
    renderQuickActions(data.quickActions);
    renderRecommendations(data.recommendations);
    renderActivity(data.recentActivity);
    renderAnalytics(data.analytics);

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    if (error.response?.status === 404) {
      showNoIdeaState();
    } else {
      showErrorState('Failed to load dashboard data');
    }
  }
}

// ======================
// LOAD AI INSIGHTS
// ======================

async function loadAIInsights(ideaId) {
  // Simple greeting with user name
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user?.data?.user?.displayName || user?.data?.user?.name || user?.displayName || user?.name || 'there';
  const firstName = userName.split(' ')[0];
  
  renderGreeting(`Hi ${firstName}, Welcome to your Dashboard`, 'Use your dashboard as a launchpad to build, validate, and grow your startup idea.');
  renderQuote({
    quote: "The best time to start was yesterday. The next best time is now.",
    author: "Startup Wisdom"
  });
}

// ======================
// RENDER FUNCTIONS
// ======================

function renderGreeting(greeting, insight) {
  const greetingEl = document.getElementById('greetingText');
  const insightEl = document.getElementById('insightText');
  
  if (greetingEl) greetingEl.textContent = greeting;
  if (insightEl) insightEl.textContent = insight;
}

function renderFocus(suggestion) {
  const focusEl = document.getElementById('focusSuggestion');
  if (focusEl) focusEl.textContent = suggestion;
}

function renderIdeaSummary(idea) {
  const contentEl = document.getElementById('ideaContent');
  const metaEl = document.getElementById('ideaMeta');
  
  if (!idea) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--muted);">
          <p style="margin-bottom: 16px;">You haven't defined your idea yet</p>
          <a href="/idea-hub.html" class="btn btn-primary btn-sm">Define Your Idea</a>
        </div>
      `;
    }
    return;
  }
  
  if (contentEl) {
    const description = idea.description || 'No description available';
    contentEl.textContent = description.length > 300 ? description.substring(0, 300) + '...' : description;
  }
  
  if (metaEl) {
    const badges = [];
    if (idea.name) {
      badges.push(`<span class="meta-badge">${idea.name}</span>`);
    }
    if (idea.updatedAt) {
      badges.push(`<span class="meta-badge">Updated ${formatTimeAgo(idea.updatedAt)}</span>`);
    }
    metaEl.innerHTML = badges.join('');
  }
}

function renderScoreRing(scoreboard) {
  const scoreEl = document.getElementById('scoreValue');
  const ringEl = document.querySelector('.score-ring-progress');
  const noScoreEl = document.getElementById('noScoreMessage');
  const scoreRingContainer = document.querySelector('.score-ring-container');
  const metricsListEl = document.querySelector('.metrics-list');
  
  if (!scoreboard || !scoreboard.overall) {
    if (scoreRingContainer) scoreRingContainer.classList.add('hidden');
    if (metricsListEl) metricsListEl.classList.add('hidden');
    if (noScoreEl) noScoreEl.classList.remove('hidden');
    return;
  }
  
  if (noScoreEl) noScoreEl.classList.add('hidden');
  if (scoreRingContainer) scoreRingContainer.classList.remove('hidden');
  if (metricsListEl) metricsListEl.classList.remove('hidden');
  
  // Score is 0-100, display as-is
  const score = scoreboard.overall || 0;
  
  if (scoreEl) scoreEl.textContent = score;
  
  if (ringEl) {
    // Calculate based on 0-100 scale
    const circumference = 339.292;
    const offset = circumference - (score / 100) * circumference;
    ringEl.style.strokeDashoffset = offset;
  }
}

function renderMetrics(scoreboard) {
  const metricsListEl = document.getElementById('metricsList');
  
  if (!metricsListEl || !scoreboard || !scoreboard.metrics) return;
  
  const metrics = scoreboard.metrics;
  const metricItems = [];
  
  if (metrics.marketPotential !== undefined) {
    metricItems.push({ name: 'Market Potential', score: metrics.marketPotential });
  }
  if (metrics.feasibility !== undefined) {
    metricItems.push({ name: 'Feasibility', score: metrics.feasibility });
  }
  if (metrics.innovation !== undefined) {
    metricItems.push({ name: 'Innovation', score: metrics.innovation });
  }
  if (metrics.scalability !== undefined) {
    metricItems.push({ name: 'Scalability', score: metrics.scalability });
  }
  
  if (metricItems.length === 0) {
    metricsListEl.classList.add('hidden');
    return;
  }
  
  metricsListEl.innerHTML = metricItems.map(item => `
    <div class="metric-item">
      <span class="metric-name">${item.name}</span>
      <span class="metric-score">${item.score}</span>
    </div>
  `).join('');
}

function renderQuickActions(actions) {
  const actionsEl = document.getElementById('quickActions');
  if (!actionsEl) return;
  
  const defaultActions = [
    { icon: 'chat', label: 'Chat', link: '/chat-page.html' },
    { icon: 'score', label: 'Score', link: '/scoreboard-page.html' },
    { icon: 'research', label: 'Research', link: '/market-research.html' },
    { icon: 'action', label: 'Actions', link: '/action-page.html' },
    { icon: 'tasks', label: 'Tasks', link: '/tasks-page.html' },
    { icon: 'brainstorm', label: 'Brainstorm', link: '/brainstorm.html' },
    { icon: 'code', label: 'CoBuilder', link: '/cobuilder2-page.html' },
    { icon: 'idea', label: 'Your Idea', link: '/idea-hub.html' },
    { icon: 'star', label: 'Marketplace', link: '/marketplace.html' },
    { icon: 'settings', label: 'Settings', link: '/settings-page.html' }
  ];
  
  const actionsToRender = actions && actions.length > 0 ? actions : defaultActions;
  
  // Show first 6, put rest in expandable section
  const visibleActions = actionsToRender.slice(0, 6);
  const hiddenActions = actionsToRender.slice(6);
  
  let html = visibleActions.map(action => {
    const iconSvg = ICONS[action.icon] || ICONS.star;
    return `
      <a href="${action.link}" class="action-btn ${action.glow ? 'glow' : ''}">
        <span class="action-icon">${iconSvg}</span>
        <span class="action-label">${action.label}</span>
      </a>
    `;
  }).join('');
  
  if (hiddenActions.length > 0) {
    html += `
      <div class="more-actions-container">
        <button class="see-more-btn" id="seeMoreBtn">See more ↓</button>
        <div class="hidden-actions" id="hiddenActions" style="display: none;">
          ${hiddenActions.map(action => {
            const iconSvg = ICONS[action.icon] || ICONS.star;
            return `
              <a href="${action.link}" class="action-btn ${action.glow ? 'glow' : ''}">
                <span class="action-icon">${iconSvg}</span>
                <span class="action-label">${action.label}</span>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  actionsEl.innerHTML = html;
  
  // Add toggle functionality
  const seeMoreBtn = document.getElementById('seeMoreBtn');
  const hiddenActionsEl = document.getElementById('hiddenActions');
  if (seeMoreBtn && hiddenActionsEl) {
    seeMoreBtn.addEventListener('click', () => {
      const isHidden = hiddenActionsEl.style.display === 'none';
      hiddenActionsEl.style.display = isHidden ? 'flex' : 'none';
      seeMoreBtn.textContent = isHidden ? 'See less ↑' : 'See more ↓';
    });
  }
}

function renderRecommendations(recommendations) {
  const recListEl = document.getElementById('recommendationsList');
  if (!recListEl) return;
  
  if (!recommendations || recommendations.length === 0) {
    recListEl.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <p>Complete more tasks to get personalized recommendations</p>
      </div>
    `;
    return;
  }
  
  recListEl.innerHTML = recommendations.slice(0, 3).map(rec => {
    const iconSvg = ICONS[rec.icon] || ICONS.star;
    return `
      <a href="${rec.link}" class="recommendation-item">
        <span class="rec-icon">${iconSvg}</span>
        <div class="rec-content">
          <div class="rec-title">${rec.title}</div>
          <div class="rec-desc">${rec.description}</div>
        </div>
        <span class="rec-priority ${rec.priority}">${rec.priority}</span>
      </a>
    `;
  }).join('');
}

function renderActivity(activities) {
  const activityListEl = document.getElementById('activityList');
  if (!activityListEl) return;
  
  if (!activities || activities.length === 0) {
    activityListEl.innerHTML = `
      <div class="no-activity">
        <p>No recent activity yet. Start exploring!</p>
      </div>
    `;
    return;
  }
  
  activityListEl.innerHTML = activities.slice(0, 5).map(activity => {
    const iconSvg = ICONS[activity.icon] || ICONS.clock;
    return `
      <div class="activity-item">
        <div class="activity-icon">${iconSvg}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-desc">${activity.description || ''}</div>
        </div>
        <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
      </div>
    `;
  }).join('');
}

function renderAnalytics(analytics) {
  if (!analytics) return;
  
  const daysActiveEl = document.getElementById('daysActive');
  const totalChatsEl = document.getElementById('totalChats');
  const totalTasksEl = document.getElementById('totalTasks');
  const completedTasksEl = document.getElementById('completedTasks');
  
  if (daysActiveEl) daysActiveEl.textContent = analytics.ideaAge || 0;
  if (totalChatsEl) totalChatsEl.textContent = analytics.totalChats || 0;
  if (totalTasksEl) totalTasksEl.textContent = analytics.totalTasks || 0;
  if (completedTasksEl) completedTasksEl.textContent = analytics.completedTasks || 0;
}

function renderQuote(quote) {
  const quoteTextEl = document.getElementById('quoteText');
  const quoteAttributionEl = document.getElementById('quoteAttribution');
  
  if (quoteTextEl && quote) {
    if (typeof quote === 'string') {
      quoteTextEl.textContent = `"${quote}"`;
      if (quoteAttributionEl) quoteAttributionEl.textContent = '';
    } else {
      quoteTextEl.textContent = `"${quote.quote || quote}"`;
      if (quoteAttributionEl && quote.author) {
        quoteAttributionEl.textContent = `— ${quote.author}`;
      }
    }
  }
}

// ======================
// UTILITY FUNCTIONS
// ======================

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showErrorState(message) {
  console.error(message);
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) greetingEl.textContent = 'Something went wrong';
  
  const insightEl = document.getElementById('insightText');
  if (insightEl) insightEl.textContent = 'Please try refreshing the page';
}
