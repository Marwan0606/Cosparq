/*  ──────────────────────────────────────────────────
    The DNA Page — idea.js
    Full DNA page logic: load, render, edit, save, 
    generate AI summary, tag inputs, milestones,
    stage pipeline, completion tracker.
    ────────────────────────────────────────────────── */

axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;

// ════════════════ STATE ════════════════
// If ?new=1 query param is present, start a blank idea
const _urlParams = new URLSearchParams(window.location.search);
if (_urlParams.get('new') === '1') {
  localStorage.removeItem('ideaId');
  // Clean URL without reload
  window.history.replaceState({}, '', window.location.pathname);
}
let ideaId = JSON.parse(localStorage.getItem('ideaId') || 'null');
let ideaData = null;   // full idea document from server
let isNewIdea = !ideaId;
let _saveTimer = null; // auto-save debounce
let _saving = false;   // prevent overlapping saves

// In-memory copies of tag/structured data (not stored in textareas)
let brandColors = [];
let brandFonts  = [];
let techTags    = [];
let milestones  = [];
let currentStage = 'idea';
let progressPercent = 0;
let progressManual = false; // true when user manually overrides the slider

// ════════════════ INTERVIEW STATE ════════════════
let interviewMessages = [];    // full conversation history [{role, content}]
let interviewBusy     = false; // prevent overlapping sends
let interviewDone     = false; // true once AI signals "complete"

// ════════════════ SECTION DEFINITIONS ════════════════
const SECTIONS = [
  {
    num: 1, field: 'idea', title: 'The Idea',
    desc: 'Your idea distilled into one clear summary. This is what the AI uses as context across all pages.',
    type: 'summary',
    color: '#c084fc',
    icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  },
  {
    num: 2, field: 'targetAudience', title: 'Target Audience',
    desc: 'Who is this for? Describe your ideal users.',
    type: 'textarea', placeholder: 'Who are your target users? Age, occupation, pain points...',
    color: '#22c55e',
    icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  },
  {
    num: 3, field: 'vision', title: 'Vision & Purpose',
    desc: 'What is the long-term vision? What impact will this have when fully realized?',
    type: 'textarea', placeholder: "Describe your app's ultimate vision and purpose...",
    color: '#3b82f6',
    icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  },
  {
    num: 4, field: 'coreProblem', title: 'Core Problem',
    desc: 'What specific pain point does this solve? Who suffers from it and how?',
    type: 'textarea', placeholder: 'Describe the problem your idea solves...',
    color: '#f97316',
    icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  },
  {
    num: 5, field: 'brandIdentity', title: 'Brand & Identity',
    desc: 'Theme, mood, colors, fonts.',
    type: 'brand',
    color: '#ec4899',
    icon: '<circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2 2 0 002-2v-1.35c0-.83.67-1.5 1.5-1.5h1.17A7.5 7.5 0 0022 12c0-5.51-4.49-10-10-10z"/>',
  },
  {
    num: 6, field: 'revenueModel', title: 'Revenue Model',
    desc: 'How will this make money? Subscription, freemium, ads, marketplace fees?',
    type: 'textarea', placeholder: 'Describe your monetization strategy...',
    color: '#10b981',
    icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  },
  {
    num: 7, field: 'techStack', title: 'Tech Stack',
    desc: 'What technologies are you using or planning to use?',
    type: 'tech',
    color: '#6366f1',
    icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  },
  {
    num: 8, field: 'stageProgress', title: 'Stage & Progress',
    desc: 'Where you are now, milestones hit, and how far along the journey.',
    type: 'stageProgress',
    color: '#a855f7',
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
];

const STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'validating', label: 'Validating' },
  { key: 'designing', label: 'Designing' },
  { key: 'building-mvp', label: 'Building MVP' },
  { key: 'mvp-done', label: 'MVP Done' },
  { key: 'launched', label: 'Launched' },
  { key: 'growing', label: 'Growing' },
  { key: 'scaling', label: 'Scaling' },
];

// ════════════════ INIT ════════════════
async function init() {
  renderSections();
  wireGlobalEvents();
  wireInterviewEvents();

  if (isNewIdea) {
    showPitchOverlay();
  } else if (ideaId) {
    await loadIdea();
  }
}

// ════════════════ RENDER ALL SECTIONS ════════════════
function renderSections() {
  const container = document.getElementById('dnaSections');
  container.innerHTML = SECTIONS.map(s => renderSection(s)).join('');
}

function renderSection(s) {
  const bodyHTML = (() => {
    switch(s.type) {
      case 'summary':  return renderSummaryBody();
      case 'textarea': return renderTextareaBody(s);
      case 'brand':         return renderBrandBody();
      case 'tech':          return renderTechBody();
      case 'stageProgress': return renderStageProgressBody();
      default: return '';
    }
  })();

  return `
    <section class="dna-section" data-field="${s.field}" style="--section-color: ${s.color};">
      <div class="bento-card">
        <div class="bento-card-header">
          <div class="bento-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" class="bento-icon">${s.icon}</svg>
          </div>
          <div class="bento-card-info">
            <div class="bento-card-title">${s.title}</div>
            <div class="bento-card-desc">${s.desc}</div>
          </div>
        </div>
        <span class="section-status js-section-status" data-field="${s.field}"></span>
        <div class="bento-card-preview js-card-preview" data-field="${s.field}"></div>
      </div>

      <div class="section-body">
        <div class="section-body-inner">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" class="section-icon">${s.icon}</svg>
              </div>
              <div>
                <h2 class="section-title">${s.title}</h2>
                <p class="section-desc">${s.desc}</p>
              </div>
            </div>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-content">
            ${bodyHTML}
          </div>
        </div>
      </div>
    </section>`;
}

function renderSummaryBody() {
  return `
    <div class="summary-content js-summary-content">
      <p class="summary-placeholder js-summary-placeholder">Fill in the sections below, then click "Generate" to create your AI-powered idea summary.</p>
      <div class="summary-text js-summary-text" style="display:none;"></div>
      <textarea class="dna-textarea js-summary-edit" style="display:none;" rows="8" placeholder="Write or edit your summary..."></textarea>
    </div>
    <div class="idea-meta">
      <span class="meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
        <span class="word-count js-word-count">0 / 600 words</span>
      </span>
    </div>
    <div class="action-buttons">
      <button class="btn btn-secondary js-edit-summary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Edit Manually
      </button>
    </div>

    <!-- Version History -->
    <div class="summary-history">
      <div class="summary-history-header js-toggle-history">
        <h3 class="summary-history-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Version History
          <span class="history-count js-history-count">0 versions</span>
        </h3>
        <svg class="chevron history-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="history-list js-history-list">
        <div class="empty-history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No version history yet</p>
          <span style="font-size: 0.85rem">Updates will appear here as you generate or edit the summary.</span>
        </div>
      </div>
    </div>`;
}

function renderTextareaBody(s) {
  return `<textarea class="dna-textarea js-dna-field" data-field="${s.field}" rows="5" placeholder="${s.placeholder}"></textarea>`;
}

function renderBrandBody() {
  return `
    <textarea class="dna-textarea js-dna-field" data-field="brandIdentity.description" rows="3" placeholder="Describe the mood, feel, and personality of your brand..."></textarea>
    <div class="brand-row">
      <div class="brand-group">
        <label>Colors</label>
        <div class="tag-input-wrap">
          <div class="tags js-brand-colors"></div>
          <div class="color-add">
            <input type="color" class="color-picker js-color-picker" value="#8400ff" />
            <button class="btn-small js-add-color">Add Color</button>
          </div>
        </div>
      </div>
      <div class="brand-group">
        <label>Fonts</label>
        <div class="tag-input-wrap">
          <div class="tags js-brand-fonts"></div>
          <input class="tag-text-input js-font-input" placeholder="Type font name + Enter" />
        </div>
      </div>
    </div>`;
}

function renderTechBody() {
  return `
    <div class="tag-input-wrap">
      <div class="tags js-tech-tags"></div>
      <input class="tag-text-input js-tech-input" placeholder="Type a technology + Enter (e.g. React, Node.js, Firebase)" />
    </div>
    <textarea class="dna-textarea js-dna-field" data-field="techStack.notes" rows="3" placeholder="Additional notes about your tech choices..." style="margin-top: 12px;"></textarea>`;
}

function renderStageProgressBody() {
  return `
    <div class="stage-pipeline js-stage-pipeline">
      ${STAGES.map(st => `<button class="stage-pill" data-stage="${st.key}">${st.label}</button>`).join('')}
    </div>
    <textarea class="dna-textarea js-dna-field" data-field="progressNotes" rows="5" placeholder="Describe what you've built so far, what you're working on now, and what's next..." style="margin-top: 16px;"></textarea>
    <div class="milestones">
      <label>Milestones</label>
      <div class="milestone-list js-milestone-list"></div>
      <div class="milestone-add">
        <input class="milestone-input js-milestone-input" placeholder="Add a milestone..." />
        <button class="btn-small js-add-milestone">Add</button>
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-header">
        <label class="progress-bar-label">Overall Progress</label>
        <span class="progress-bar-value js-progress-value">0%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill js-progress-fill"></div>
      </div>
      <input type="range" class="progress-bar-slider js-progress-slider" min="0" max="100" value="0" />
      <div class="progress-bar-hint">
        <span class="js-progress-mode">Auto</span> &mdash; drag to override
      </div>
    </div>`;
}

// ════════════════ WIRE EVENTS ════════════════
function wireGlobalEvents() {
  // Bento card click → open modal
  document.querySelectorAll('.bento-card').forEach(card => {
    card.addEventListener('click', () => {
      const section = card.closest('.dna-section');
      // Close any other open modal first
      document.querySelectorAll('.dna-section.open').forEach(s => {
        if (s !== section) s.classList.remove('open');
      });
      section.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  // Modal close button
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
  });

  // Backdrop click (clicking on .section-body itself, not inner content)
  document.querySelectorAll('.section-body').forEach(body => {
    body.addEventListener('click', (e) => {
      if (e.target === body) closeModal();
    });
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Textarea changes → trigger auto-save
  document.querySelectorAll('.js-dna-field').forEach(el => {
    el.addEventListener('input', () => { queueAutoSave(); updateCompletion(); });
  });

  // Idea name
  document.querySelector('.js-idea-name').addEventListener('input', () => { queueAutoSave(); });

  // Edit Manually button for summary
  document.querySelector('.js-edit-summary')?.addEventListener('click', toggleSummaryEdit);

  // Summary edit textarea → auto-save
  document.querySelector('.js-summary-edit')?.addEventListener('input', () => {
    const textarea = document.querySelector('.js-summary-edit');
    updateWordCount(textarea.value);
    updateCompletion();
    queueAutoSave();
  });

  // Version history toggle
  document.querySelector('.js-toggle-history')?.addEventListener('click', toggleHistoryPanel);

  // Stage pills
  document.querySelectorAll('.stage-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      currentStage = pill.dataset.stage;
      renderStagePills();
      queueAutoSave();
      updateCompletion();
    });
  });

  // Brand colors
  document.querySelector('.js-add-color')?.addEventListener('click', () => {
    const picker = document.querySelector('.js-color-picker');
    const hex = picker.value;
    if (!brandColors.includes(hex)) {
      brandColors.push(hex);
      renderBrandColorTags();
      queueAutoSave();
      updateCompletion();
    }
  });

  // Brand fonts (Enter key)
  document.querySelector('.js-font-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !brandFonts.includes(val)) {
        brandFonts.push(val);
        renderBrandFontTags();
        e.target.value = '';
        queueAutoSave();
        updateCompletion();
      }
    }
  });

  // Tech tags (Enter key)
  document.querySelector('.js-tech-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !techTags.includes(val)) {
        techTags.push(val);
        renderTechTagList();
        e.target.value = '';
        queueAutoSave();
        updateCompletion();
      }
    }
  });

  // Add milestone
  document.querySelector('.js-add-milestone')?.addEventListener('click', addMilestone);
  document.querySelector('.js-milestone-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addMilestone(); }
  });

  // Progress slider (manual override)
  const slider = document.querySelector('.js-progress-slider');
  if (slider) {
    slider.addEventListener('input', () => {
      progressPercent = +slider.value;
      progressManual = true;
      updateProgressBar();
      queueAutoSave();
    });
    // Double-click to reset to auto
    slider.addEventListener('dblclick', () => {
      progressManual = false;
      progressPercent = calcAutoProgress();
      updateProgressBar();
      queueAutoSave();
    });
  }
}

// ════════════════ CLOSE MODAL ════════════════
function closeModal() {
  document.querySelectorAll('.dna-section.open').forEach(s => s.classList.remove('open'));
  document.body.style.overflow = '';
  updateCardPreviews();
}

// ════════════════ CARD PREVIEW TEXT ════════════════
function updateCardPreviews() {
  SECTIONS.forEach(s => {
    const el = document.querySelector(`.js-card-preview[data-field="${s.field}"]`);
    if (!el) return;
    let text = '';
    switch (s.field) {
      case 'idea':
        text = document.querySelector('.js-summary-text')?.textContent?.trim() || '';
        break;
      case 'brandIdentity': {
        const desc = getField('brandIdentity.description');
        const parts = [];
        if (desc) parts.push(desc);
        if (brandColors.length) parts.push(brandColors.join(', '));
        if (brandFonts.length) parts.push(brandFonts.join(', '));
        text = parts.join(' · ');
        break;
      }
      case 'techStack':
        text = techTags.length ? techTags.join(', ') : getField('techStack.notes');
        break;
      case 'stageProgress': {
        const label = STAGES.find(st => st.key === currentStage)?.label || '';
        const parts = [label];
        if (milestones.length) parts.push(`${milestones.filter(m => m.completed).length}/${milestones.length} milestones`);
        parts.push(`${progressPercent}%`);
        text = parts.join(' · ');
        break;
      }
      default:
        text = getField(s.field);
    }
    el.textContent = text || '';
  });
}

// ════════════════ LOAD EXISTING IDEA ════════════════
async function loadIdea() {
  try {
    const res = await axios.get(`/api/save/idea/${ideaId}`);
    ideaData = res.data.idea;
    if (!ideaData) { isNewIdea = true; return; }

    // Populate name
    document.querySelector('.js-idea-name').value = ideaData.ideaName || '';

    // Populate textareas
    const fieldMap = {
      vision: 'vision',
      coreProblem: 'coreProblem',
      targetAudience: 'targetAudience',
      revenueModel: 'revenueModel',
      progressNotes: 'progressNotes',
    };
    for (const [dataField, htmlField] of Object.entries(fieldMap)) {
      const el = document.querySelector(`.js-dna-field[data-field="${htmlField}"]`);
      if (el && ideaData[dataField]) el.value = ideaData[dataField];
    }

    // Brand identity
    if (ideaData.brandIdentity) {
      const descEl = document.querySelector('.js-dna-field[data-field="brandIdentity.description"]');
      if (descEl) descEl.value = ideaData.brandIdentity.description || '';
      brandColors = ideaData.brandIdentity.colors || [];
      brandFonts  = ideaData.brandIdentity.fonts  || [];
      renderBrandColorTags();
      renderBrandFontTags();
    }

    // Tech stack
    if (ideaData.techStack) {
      const notesEl = document.querySelector('.js-dna-field[data-field="techStack.notes"]');
      if (notesEl) notesEl.value = ideaData.techStack.notes || '';
      techTags = ideaData.techStack.tags || [];
      renderTechTagList();
    }

    // Stage
    currentStage = ideaData.progressStage || 'idea';
    renderStagePills();

    // Milestones
    milestones = (ideaData.progressMilestones || []).map(m => ({ ...m }));
    renderMilestoneList();

    // Progress percent
    if (ideaData.progressPercent != null) {
      progressPercent = ideaData.progressPercent;
      progressManual = ideaData.progressPercentManual || false;
    } else {
      progressManual = false;
    }
    if (!progressManual) progressPercent = calcAutoProgress();
    updateProgressBar();

    // Summary
    if (ideaData.idea) {
      const summaryText = document.querySelector('.js-summary-text');
      const placeholder = document.querySelector('.js-summary-placeholder');
      summaryText.textContent = ideaData.idea;
      summaryText.style.display = 'block';
      placeholder.style.display = 'none';
      updateWordCount(ideaData.idea);
    }

    // Render version history
    renderHistory();

    updateCompletion();
    updateCardPreviews();
  } catch (err) {
    if (err.response?.status === 403) {
      await refreshToken();
      return loadIdea();
    }
    console.error('Failed to load idea:', err);
  }
}

// ════════════════ AUTO-SAVE ════════════════
function queueAutoSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveDna(), 1500); // 1.5s debounce
}

async function saveDna(historySource, historySummary) {
  const ideaName = document.querySelector('.js-idea-name').value.trim();
  if (!ideaName || _saving) return;

  _saving = true;
  showSaveIndicator('saving');

  // Gather all field values
  const data = {
    ideaName,
    vision:                getField('vision'),
    coreProblem:           getField('coreProblem'),
    targetAudience:        getField('targetAudience'),
    revenueModel:          getField('revenueModel'),
    progressNotes:         getField('progressNotes'),
    progressStage:         currentStage,
    progressMilestones:    milestones,
    progressPercent,
    progressPercentManual: progressManual,
    brandIdentity: {
      description: getField('brandIdentity.description'),
      colors: brandColors,
      fonts:  brandFonts,
    },
    techStack: {
      tags:  techTags,
      notes: getField('techStack.notes'),
    },
  };

  // Get the summary text — from edit textarea if visible, otherwise from display
  const editTA = document.querySelector('.js-summary-edit');
  const summaryEl = document.querySelector('.js-summary-text');
  const summaryVal = (editTA && editTA.style.display !== 'none')
    ? editTA.value.trim()
    : summaryEl?.textContent?.trim() || '';
  if (summaryVal) data.idea = summaryVal;

  // If we have a history source, push a new version entry
  if (historySource && summaryVal) {
    const existingHistory = ideaData?.ideaHistory || [];
    existingHistory.push({
      idea: summaryVal,
      updatedAt: new Date().toISOString(),
      updateSource: historySource,
      updateSummary: historySummary || '',
    });
    data.ideaHistory = existingHistory;
  }

  try {
    if (isNewIdea) {
      if (!data.idea) data.idea = ideaName;
      const res = await axios.post('/api/save/idea', { idea: data.idea, ideaName: data.ideaName });
      ideaId = res.data.ideaRes._id;
      localStorage.setItem('ideaId', JSON.stringify(ideaId));
      isNewIdea = false;
      await axios.patch(`/api/save/idea/${ideaId}`, data);
    } else {
      await axios.patch(`/api/save/idea/${ideaId}`, data);
    }

    // Update in-memory data with history
    if (data.ideaHistory) {
      if (!ideaData) ideaData = {};
      ideaData.ideaHistory = data.ideaHistory;
    }

    showSaveIndicator('saved');
  } catch (err) {
    if (err.response?.status === 403) {
      await refreshToken();
      _saving = false;
      return saveDna(historySource, historySummary);
    }
    showSaveIndicator('error');
    console.error('Save error:', err);
  } finally {
    _saving = false;
  }
}

function showSaveIndicator(state) {
  let el = document.querySelector('.js-auto-save-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'auto-save-status js-auto-save-status';
    document.body.appendChild(el);
  }
  if (state === 'saving') {
    el.innerHTML = '<span class="spinner"></span> Saving...';
    el.className = 'auto-save-status js-auto-save-status show';
  } else if (state === 'saved') {
    el.textContent = 'Saved';
    el.className = 'auto-save-status js-auto-save-status show saved';
    setTimeout(() => el.classList.remove('show'), 2000);
  } else {
    el.textContent = 'Save failed';
    el.className = 'auto-save-status js-auto-save-status show error';
    setTimeout(() => el.classList.remove('show'), 3000);
  }
}

function getField(dataField) {
  const el = document.querySelector(`.js-dna-field[data-field="${dataField}"]`);
  return el ? el.value.trim() : '';
}

// ════════════════ GENERATE SUMMARY ════════════════
async function generateSummary() {
  const btn = document.querySelector('.js-generate-summary');
  const origText = btn.innerHTML;

  // Gather DNA sections for the AI
  const payload = {
    ideaName:              document.querySelector('.js-idea-name').value.trim(),
    vision:                getField('vision'),
    coreProblem:           getField('coreProblem'),
    targetAudience:        getField('targetAudience'),
    revenueModel:          getField('revenueModel'),
    progressStage:         currentStage,
    progressNotes:         getField('progressNotes'),
    brandIdentity: {
      description: getField('brandIdentity.description'),
      colors: brandColors,
      fonts:  brandFonts,
    },
    techStack: {
      tags:  techTags,
      notes: getField('techStack.notes'),
    },
  };

  // Check at least something is filled
  const hasContent = payload.vision || payload.coreProblem || payload.targetAudience ||
    payload.revenueModel || payload.progressNotes;
  if (!hasContent) {
    showToast('Fill in at least one section before generating a summary.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const res = await axios.post('/api/idea-hub/generate-summary', payload);
    const summary = res.data.summary;

    // Display summary
    const summaryText = document.querySelector('.js-summary-text');
    const summaryEdit = document.querySelector('.js-summary-edit');
    const placeholder = document.querySelector('.js-summary-placeholder');
    summaryText.textContent = summary;
    summaryText.style.display = 'block';
    summaryEdit.style.display = 'none';
    placeholder.style.display = 'none';
    updateWordCount(summary);
    updateCompletion();

    // Push to history and auto-save immediately
    await saveDna('ai_sync', 'AI-generated summary');
    renderHistory();
    showToast('Idea summary generated!', 'success');
  } catch (err) {
    if (err.response?.status === 403) {
      await refreshToken();
      btn.disabled = false;
      btn.innerHTML = origText;
      return generateSummary();
    }
    showToast('Failed to generate summary. Try again.', 'error');
    console.error('Summary generation error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ════════════════ TAG RENDERING ════════════════
function renderBrandColorTags() {
  const container = document.querySelector('.js-brand-colors');
  if (!container) return;
  container.innerHTML = brandColors.map((c, i) => `
    <span class="tag color-tag" style="border-color:${c}">
      <span class="color-swatch" style="background:${c}"></span>${c}
      <button class="tag-remove" data-type="color" data-idx="${i}">&times;</button>
    </span>`).join('');
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      brandColors.splice(+btn.dataset.idx, 1);
      renderBrandColorTags();
      queueAutoSave();
      updateCompletion();
    });
  });
}

function renderBrandFontTags() {
  const container = document.querySelector('.js-brand-fonts');
  if (!container) return;
  container.innerHTML = brandFonts.map((f, i) => `
    <span class="tag">${f}
      <button class="tag-remove" data-type="font" data-idx="${i}">&times;</button>
    </span>`).join('');
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      brandFonts.splice(+btn.dataset.idx, 1);
      renderBrandFontTags();
      queueAutoSave();
      updateCompletion();
    });
  });
}

function renderTechTagList() {
  const container = document.querySelector('.js-tech-tags');
  if (!container) return;
  container.innerHTML = techTags.map((t, i) => `
    <span class="tag">${t}
      <button class="tag-remove" data-type="tech" data-idx="${i}">&times;</button>
    </span>`).join('');
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      techTags.splice(+btn.dataset.idx, 1);
      renderTechTagList();
      queueAutoSave();
      updateCompletion();
    });
  });
}

// ════════════════ STAGE PILLS ════════════════
function renderStagePills() {
  const stageIdx = STAGES.findIndex(s => s.key === currentStage);
  document.querySelectorAll('.stage-pill').forEach(pill => {
    const pillIdx = STAGES.findIndex(s => s.key === pill.dataset.stage);
    pill.classList.toggle('active', pill.dataset.stage === currentStage);
    pill.classList.toggle('passed', pillIdx < stageIdx);
  });
}

// ════════════════ MILESTONES ════════════════
function addMilestone() {
  const input = document.querySelector('.js-milestone-input');
  const val = input.value.trim();
  if (!val) return;
  milestones.push({ label: val, completed: false });
  input.value = '';
  renderMilestoneList();
  queueAutoSave();
  updateCompletion();
}

function renderMilestoneList() {
  const container = document.querySelector('.js-milestone-list');
  if (!container) return;
  container.innerHTML = milestones.map((m, i) => `
    <div class="milestone-item${m.completed ? ' completed' : ''}">
      <input type="checkbox" class="milestone-check" data-idx="${i}" ${m.completed ? 'checked' : ''} />
      <span class="milestone-label">${m.label}</span>
      <button class="milestone-remove" data-idx="${i}">&times;</button>
    </div>`).join('');

  container.querySelectorAll('.milestone-check').forEach(cb => {
    cb.addEventListener('change', () => {
      milestones[+cb.dataset.idx].completed = cb.checked;
      renderMilestoneList();
      queueAutoSave();
    });
  });
  container.querySelectorAll('.milestone-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      milestones.splice(+btn.dataset.idx, 1);
      renderMilestoneList();
      queueAutoSave();
      updateCompletion();
    });
  });
}

// ════════════════ COMPLETION TRACKER ════════════════
function updateCompletion() {
  let filled = 0;
  const total = 8;

  // 1. Summary (check display text or edit textarea)
  const summaryText = document.querySelector('.js-summary-text');
  const summaryEdit = document.querySelector('.js-summary-edit');
  const hasSummary = (summaryText && summaryText.textContent.trim()) ||
                     (summaryEdit && summaryEdit.style.display !== 'none' && summaryEdit.value.trim());
  if (hasSummary) filled++;

  // 2-5. Simple textareas
  ['vision', 'coreProblem', 'targetAudience', 'revenueModel'].forEach(f => {
    if (getField(f)) filled++;
  });

  // 6. Brand identity
  if (getField('brandIdentity.description') || brandColors.length || brandFonts.length) filled++;

  // 7. Tech stack
  if (techTags.length || getField('techStack.notes')) filled++;

  // 8. Stage & Progress (has stage or notes or milestones)
  if ((currentStage && currentStage !== 'idea') || getField('progressNotes') || milestones.length) filled++;

  const label = document.querySelector('.js-completion-label');
  const fill  = document.querySelector('.js-completion-fill');
  if (label) label.textContent = `${filled} / ${total} sections`;
  if (fill) fill.style.width = `${Math.round((filled / total) * 100)}%`;

  // Update individual status badges
  updateStatusBadges();
  updateCardPreviews();

  // Re-calculate auto-progress if not manually overridden
  if (!progressManual) {
    progressPercent = calcAutoProgress();
    updateProgressBar();
  }
}

function updateStatusBadges() {
  const statuses = {
    idea:                  !!(document.querySelector('.js-summary-text')?.textContent?.trim() || (document.querySelector('.js-summary-edit')?.style.display !== 'none' && document.querySelector('.js-summary-edit')?.value?.trim())),
    vision:                !!getField('vision'),
    coreProblem:           !!getField('coreProblem'),
    targetAudience:        !!getField('targetAudience'),
    revenueModel:          !!getField('revenueModel'),
    brandIdentity:         !!(getField('brandIdentity.description') || brandColors.length || brandFonts.length),
    techStack:             !!(techTags.length || getField('techStack.notes')),
    stageProgress:         !!((currentStage && currentStage !== 'idea') || getField('progressNotes') || milestones.length),
  };

  document.querySelectorAll('.js-section-status').forEach(el => {
    const field = el.dataset.field;
    const isFilled = statuses[field];
    el.textContent = isFilled ? 'Filled' : 'Empty';
    el.className = `section-status js-section-status ${isFilled ? 'filled' : 'empty'}`;
    el.dataset.field = field;
  });
}

// ════════════════ PROGRESS BAR ════════════════
function calcAutoProgress() {
  // Base from current stage position (0-80%)
  const stageIdx = STAGES.findIndex(s => s.key === currentStage);
  const stageProgress = stageIdx >= 0 ? Math.round((stageIdx / (STAGES.length - 1)) * 80) : 0;

  // Milestone bonus (up to 15%)
  let milestoneBonus = 0;
  if (milestones.length > 0) {
    const completed = milestones.filter(m => m.completed).length;
    milestoneBonus = Math.round((completed / milestones.length) * 15);
  }

  // Content bonus — progress notes filled adds a small bump (up to 5%)
  const hasNotes = getField('progressNotes') ? 5 : 0;

  return Math.min(100, stageProgress + milestoneBonus + hasNotes);
}

function updateProgressBar() {
  const fill  = document.querySelector('.js-progress-fill');
  const value = document.querySelector('.js-progress-value');
  const slider = document.querySelector('.js-progress-slider');
  const mode  = document.querySelector('.js-progress-mode');
  if (!fill) return;

  fill.style.width = `${progressPercent}%`;
  if (value) value.textContent = `${progressPercent}%`;
  if (slider) slider.value = progressPercent;
  if (mode) mode.textContent = progressManual ? 'Manual' : 'Auto';
}

// ════════════════ HELPERS ════════════════
function updateWordCount(text) {
  const count = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const el = document.querySelector('.js-word-count');
  if (el) el.textContent = `${count} / 600 words`;
}

// ════════════════ EDIT MANUALLY (SUMMARY) ════════════════
function toggleSummaryEdit() {
  const textEl = document.querySelector('.js-summary-text');
  const editTA = document.querySelector('.js-summary-edit');
  const placeholder = document.querySelector('.js-summary-placeholder');
  const btn = document.querySelector('.js-edit-summary');

  if (editTA.style.display === 'none') {
    // Enter edit mode
    editTA.value = textEl?.textContent?.trim() || '';
    textEl.style.display = 'none';
    placeholder.style.display = 'none';
    editTA.style.display = 'block';
    editTA.focus();
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Done Editing`;
  } else {
    // Exit edit mode — commit text
    const newText = editTA.value.trim();
    if (newText) {
      textEl.textContent = newText;
      textEl.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      textEl.style.display = 'none';
      placeholder.style.display = 'block';
    }
    editTA.style.display = 'none';
    updateWordCount(newText);
    updateCompletion();
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Manually`;

    // Save with history entry for manual edit
    saveDna('manual', 'Manual edit');
    renderHistory();
  }
}

// ════════════════ VERSION HISTORY ════════════════
function toggleHistoryPanel() {
  const list = document.querySelector('.js-history-list');
  const chevron = document.querySelector('.history-chevron');
  list.classList.toggle('expanded');
  chevron?.classList.toggle('rotated');
}

function renderHistory() {
  const list = document.querySelector('.js-history-list');
  const countEl = document.querySelector('.js-history-count');
  if (!list) return;

  const history = ideaData?.ideaHistory || [];
  if (countEl) countEl.textContent = `${history.length} version${history.length !== 1 ? 's' : ''}`;

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-history">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No version history yet</p>
        <span style="font-size: 0.85rem">Updates will appear here as you generate or edit the summary.</span>
      </div>`;
    return;
  }

  const sorted = [...history].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  list.innerHTML = sorted.map(item => `
    <div class="history-item" data-id="${item._id || ''}">
      <div class="history-icon ${item.updateSource || 'manual'}">
        ${getSourceIcon(item.updateSource)}
      </div>
      <div class="history-content">
        <div class="history-date">${formatDate(item.updatedAt)}</div>
        <div class="history-summary">${item.updateSummary || getSourceLabel(item.updateSource)}</div>
        <div class="history-preview">${truncateText(item.idea, 120)}</div>
      </div>
    </div>
  `).join('');

  // Click to restore
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const entry = history.find(h => (h._id || '') === id);
      if (entry?.idea) {
        const summaryText = document.querySelector('.js-summary-text');
        const placeholder = document.querySelector('.js-summary-placeholder');
        summaryText.textContent = entry.idea;
        summaryText.style.display = 'block';
        placeholder.style.display = 'none';
        document.querySelector('.js-summary-edit').style.display = 'none';
        updateWordCount(entry.idea);
        updateCompletion();
        queueAutoSave();
        showToast('Restored version from ' + formatDate(entry.updatedAt), 'success');
      }
    });
  });
}

function getSourceIcon(source) {
  switch (source) {
    case 'ai_sync':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
    case 'initial':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  }
}

function getSourceLabel(source) {
  switch (source) {
    case 'ai_sync': return 'AI-generated summary';
    case 'initial': return 'Initial version';
    default: return 'Manual edit';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function truncateText(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function showToast(msg, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

async function refreshToken() {
  const refreshTokenStr = localStorage.getItem('refreshToken');
  const response = await axios.post('http://localhost:4004/token', { token: refreshTokenStr });
  const newToken = response.data.accessToken;
  localStorage.setItem('accessToken', newToken);
  axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
}

// ════════════════ PITCH OVERLAY ════════════════
function showPitchOverlay() {
  const overlay = document.getElementById('pitchOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Auto-focus the textarea after animation
    setTimeout(() => document.getElementById('pitchInput')?.focus(), 400);
  }
}

function hidePitchOverlay() {
  const overlay = document.getElementById('pitchOverlay');
  if (overlay) overlay.classList.add('hidden');
}

// ════════════════ INTERVIEW FLOW ════════════════
function wireInterviewEvents() {
  // Pitch overlay — Enter to submit (Shift+Enter = new line)
  const pitchInput = document.getElementById('pitchInput');
  const pitchBtn   = document.getElementById('pitchSubmit');
  if (pitchInput) {
    pitchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitPitch();
      }
    });
  }
  if (pitchBtn) pitchBtn.addEventListener('click', submitPitch);

  // Close pitch overlay — load most recent idea or go to idea hub
  const pitchClose = document.getElementById('pitchClose');
  if (pitchClose) pitchClose.addEventListener('click', async () => {
    hidePitchOverlay();
    document.body.style.overflow = '';
    try {
      const res = await axios.get('/api/save/ideas');
      const ideas = (res.data?.idea || res.data || []);
      if (ideas.length > 0) {
        // Pick the most recently updated idea
        ideas.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        const latest = ideas[0];
        ideaId = latest._id;
        localStorage.setItem('ideaId', JSON.stringify(ideaId));
        isNewIdea = false;
        await loadIdea();
      } else {
        window.location.href = '/idea-hub.html';
      }
    } catch {
      window.location.href = '/idea-hub.html';
    }
  });

  // Interview — Enter to send (Shift+Enter = new line)
  const intInput = document.getElementById('interviewInput');
  const intSend  = document.getElementById('interviewSend');
  if (intInput) {
    intInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendInterviewAnswer();
      }
    });
    // Auto-resize
    intInput.addEventListener('input', () => {
      intInput.style.height = 'auto';
      intInput.style.height = Math.min(intInput.scrollHeight, 120) + 'px';
    });
  }
  if (intSend) intSend.addEventListener('click', sendInterviewAnswer);

  // Skip button
  const skipBtn = document.getElementById('interviewSkip');
  if (skipBtn) skipBtn.addEventListener('click', skipInterview);
}

function submitPitch() {
  const pitchInput = document.getElementById('pitchInput');
  const text = pitchInput?.value?.trim();
  if (!text) {
    pitchInput?.focus();
    return;
  }
  // Transition: hide pitch, open interview
  hidePitchOverlay();
  openInterview(text);
}

function openInterview(initialIdea) {
  interviewMessages = [];
  interviewBusy = false;
  interviewDone = false;

  const modal = document.getElementById('interviewModal');
  const msgArea = document.getElementById('interviewMessages');
  if (modal) modal.classList.remove('hidden');
  if (msgArea) msgArea.innerHTML = '';
  document.body.style.overflow = 'hidden';

  // Show the user's first message
  addInterviewBubble('user', initialIdea);
  interviewMessages.push({ role: 'user', content: initialIdea });

  // Send to AI
  callInterviewAPI();
}

async function callInterviewAPI() {
  if (interviewBusy || interviewDone) return;
  interviewBusy = true;
  setInterviewInputEnabled(false);
  showTypingIndicator();
  updateInterviewStatus('Thinking…');

  // After 3s of waiting, show a reassurance message so the user isn't left wondering
  const reassuranceTimer = setTimeout(() => {
    hideTypingIndicator();
    addInterviewBubble('ai', "Thanks! Give me a minute — I'm writing your Idea DNA page for you ✍️");
    updateInterviewStatus('Building your DNA board…');
    showTypingIndicator();
  }, 3000);

  try {
    const res = await axios.post('/api/idea-hub/interview', {
      messages: interviewMessages,
    });

    clearTimeout(reassuranceTimer);
    hideTypingIndicator();
    const data = res.data;

    if (data.type === 'complete') {
      interviewDone = true;

      // Store the wrap-up message as plain text for history
      const wrapMsg = data.message || "Great — I've got everything I need! Building your DNA board now…";
      interviewMessages.push({ role: 'assistant', content: wrapMsg });

      // Show wrap-up message
      addInterviewBubble('ai', wrapMsg);

      // Brief pause, then show system message and fill the board
      setTimeout(() => {
        addInterviewBubble('system', '✓ DNA board populated!');
        updateInterviewStatus('Complete!');
        setInterviewInputEnabled(false);
      }, 800);

      setTimeout(() => {
        closeInterview();
        populateDnaSections(data.sections, data.suggestedName);
      }, 1800);

    } else {
      // It's a question — store ONLY the question text (not the JSON wrapper)
      const question = typeof data.message === 'string' ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));

      // Safety: if the "question" looks like leaked raw JSON, don't display it
      if (question.trim().startsWith('{') && question.includes('"type"')) {
        console.warn('Received raw JSON as question — attempting local parse');
        try {
          const parsed = JSON.parse(question);
          if (parsed.type === 'complete' && parsed.sections) {
            interviewDone = true;
            const wrapMsg = parsed.message || "Great — I've got everything I need! Building your DNA board now…";
            interviewMessages.push({ role: 'assistant', content: wrapMsg });
            addInterviewBubble('ai', wrapMsg);
            setTimeout(() => {
              addInterviewBubble('system', '✓ DNA board populated!');
              updateInterviewStatus('Complete!');
              setInterviewInputEnabled(false);
            }, 800);
            setTimeout(() => {
              closeInterview();
              populateDnaSections(parsed.sections, parsed.suggestedName);
            }, 1800);
            return;
          } else if (parsed.message) {
            // Use the extracted message instead of raw JSON
            interviewMessages.push({ role: 'assistant', content: parsed.message });
            addInterviewBubble('ai', parsed.message);
            setInterviewInputEnabled(true);
            updateInterviewStatus('Listening…');
            document.getElementById('interviewInput')?.focus();
            return;
          }
        } catch (_) { /* not valid JSON, display as-is */ }
      }

      interviewMessages.push({ role: 'assistant', content: question });
      addInterviewBubble('ai', question);
      setInterviewInputEnabled(true);
      updateInterviewStatus('Listening…');
      document.getElementById('interviewInput')?.focus();
    }
  } catch (err) {
    clearTimeout(reassuranceTimer);
    hideTypingIndicator();
    console.error('Interview API error:', err);
    if (err.response?.status === 403) {
      await refreshToken();
      interviewBusy = false;
      return callInterviewAPI();
    }
    addInterviewBubble('system', 'Something went wrong. You can skip the interview and fill the board manually.');
    setInterviewInputEnabled(true);
  } finally {
    interviewBusy = false;
  }
}

function sendInterviewAnswer() {
  if (interviewBusy || interviewDone) return;
  const input = document.getElementById('interviewInput');
  const text = input?.value?.trim();
  if (!text) return;

  addInterviewBubble('user', text);
  interviewMessages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';

  callInterviewAPI();
}

function skipInterview() {
  if (interviewBusy || interviewDone) return;

  // Tell the AI to fill everything from its own knowledge
  const skipMsg = "I can't answer any more questions — please just fill in all the sections using your best judgment based on what I've told you so far.";
  addInterviewBubble('user', skipMsg);
  interviewMessages.push({ role: 'user', content: skipMsg });

  // Trigger the API call which will get a "complete" response
  callInterviewAPI();
}

function closeInterview() {
  const modal = document.getElementById('interviewModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── UI helpers ──
function addInterviewBubble(role, text) {
  const container = document.getElementById('interviewMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `interview-msg ${role}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('interviewMessages');
  if (!container) return;
  let ind = container.querySelector('.typing-indicator');
  if (ind) return;
  ind = document.createElement('div');
  ind.className = 'typing-indicator';
  ind.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(ind);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  const ind = document.querySelector('#interviewMessages .typing-indicator');
  if (ind) ind.remove();
}

function setInterviewInputEnabled(enabled) {
  const input = document.getElementById('interviewInput');
  const btn   = document.getElementById('interviewSend');
  if (input) input.disabled = !enabled;
  if (btn) btn.disabled = !enabled;
}

function updateInterviewStatus(text) {
  const el = document.querySelector('.js-interview-status');
  if (el) el.textContent = text;
}

// ════════════════ POPULATE DNA FROM INTERVIEW ════════════════
function populateDnaSections(sections, suggestedName) {
  if (!sections) return;

  // ── Idea name ──
  const nameInput = document.querySelector('.js-idea-name');
  if (suggestedName && nameInput && !nameInput.value.trim()) {
    nameInput.value = suggestedName;
  }

  // ── Simple textarea fields ──
  const textFields = {
    vision: 'vision',
    coreProblem: 'coreProblem',
    targetAudience: 'targetAudience',
    revenueModel: 'revenueModel',
  };
  for (const [sectionKey, domField] of Object.entries(textFields)) {
    if (sections[sectionKey]) {
      const el = document.querySelector(`.js-dna-field[data-field="${domField}"]`);
      if (el) el.value = sections[sectionKey];
    }
  }

  // ── Brand Identity ──
  if (sections.brandIdentity) {
    const descEl = document.querySelector('.js-dna-field[data-field="brandIdentity.description"]');
    if (descEl && sections.brandIdentity.description) descEl.value = sections.brandIdentity.description;

    if (Array.isArray(sections.brandIdentity.colors)) {
      brandColors = sections.brandIdentity.colors.filter(c => typeof c === 'string');
      renderBrandColorTags();
    }
    if (Array.isArray(sections.brandIdentity.fonts)) {
      brandFonts = sections.brandIdentity.fonts.filter(f => typeof f === 'string');
      renderBrandFontTags();
    }
  }

  // ── Tech Stack ──
  if (sections.techStack) {
    if (Array.isArray(sections.techStack.tags)) {
      techTags = sections.techStack.tags.filter(t => typeof t === 'string');
      renderTechTagList();
    }
    const techNotesEl = document.querySelector('.js-dna-field[data-field="techStack.notes"]');
    if (techNotesEl && sections.techStack.notes) techNotesEl.value = sections.techStack.notes;
  }

  // ── Stage & Progress ──
  if (sections.progressStage) {
    currentStage = sections.progressStage;
    renderStagePills();
  }
  const pNotesEl = document.querySelector('.js-dna-field[data-field="progressNotes"]');
  if (pNotesEl && sections.progressNotes) pNotesEl.value = sections.progressNotes;

  // ── The Idea summary ──
  if (sections.idea) {
    const summaryText  = document.querySelector('.js-summary-text');
    const placeholder  = document.querySelector('.js-summary-placeholder');
    const summaryEdit  = document.querySelector('.js-summary-edit');
    if (summaryText) {
      summaryText.textContent = sections.idea;
      summaryText.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (summaryEdit) summaryEdit.style.display = 'none';
    updateWordCount(sections.idea);
  }

  // ── Refresh everything ──
  updateCompletion();
  updateCardPreviews();

  // ── Save immediately with initial history entry ──
  saveDna('initial', 'Auto-filled by AI co-founder interview');
  renderHistory();
  showToast('DNA board filled by your AI co-founder!', 'success');
}

// ════════════════ BOOT ════════════════
init();