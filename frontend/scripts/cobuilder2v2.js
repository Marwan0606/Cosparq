// frontend/scripts/cobuilder2v2.js
// CoBuilder 2 — Landing page generator with Kimi K2.5, version history, and diff-based editing

const API_BASE = '';
const token = localStorage.getItem('accessToken');
const ideaId = JSON.parse(localStorage.getItem('ideaId'));

if (!token) { window.location.href = '/auth.html'; }
if (!ideaId) { window.location.href = '/idea-hub.html'; }

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
});

// ─── STATE ──────────────────────────────────────────────────────────────────────
let ideaText = '';
let ideaName = '';
let versions = [];          // Array of { versionNumber, code, description, createdAt }
let currentVersionIdx = -1; // Index into versions[]
let isLoading = false;

// ─── DOM REFS ───────────────────────────────────────────────────────────────────
const $ideaName = document.getElementById('ideaName');
const $ideaText = document.getElementById('ideaText');
const $setupPanel = document.getElementById('setupPanel');
const $previewContainer = document.getElementById('previewContainer');
const $generateBtn = document.getElementById('generateBtn');
const $loadingOverlay = document.getElementById('loadingOverlay');
const $loadingText = document.getElementById('loadingText');
const $previewIframe = document.getElementById('previewIframe');
const $editInput = document.getElementById('editInput');
const $editBtn = document.getElementById('editBtn');
const $versionChips = document.getElementById('versionChips');
const $paletteGrid = document.getElementById('paletteGrid');
const $stylePills = document.getElementById('stylePills');
const $additionalInput = document.getElementById('additionalInput');

// ─── COLOR PALETTES ─────────────────────────────────────────────────────────────
const PALETTES = [
  { name: 'Purple Haze', colors: ['#8400ff', '#a855f7', '#6d28d9', '#1e1b4b'] },
  { name: 'Ocean Blue', colors: ['#0ea5e9', '#3b82f6', '#1d4ed8', '#0c1e3a'] },
  { name: 'Sunset', colors: ['#f97316', '#f59e0b', '#ef4444', '#1c1917'] },
  { name: 'Forest', colors: ['#22c55e', '#16a34a', '#166534', '#0a1a0f'] },
  { name: 'Monochrome', colors: ['#fafafa', '#a1a1aa', '#52525b', '#18181b'] },
  { name: 'Rose Gold', colors: ['#f43f5e', '#e11d48', '#be185d', '#1a0a10'] },
  { name: 'Neon', colors: ['#06ffa5', '#00d4ff', '#8b5cf6', '#0a0a0b'] },
  { name: 'Warm Sand', colors: ['#d4a574', '#b88b6a', '#8b6f5e', '#1c1410'] },
];

let selectedPalette = '';
let selectedStyle = '';

function initPalettes() {
  PALETTES.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.title = p.name;
    btn.dataset.palette = p.name;
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    p.colors.forEach(c => {
      const s = document.createElement('span');
      s.style.background = c;
      swatch.appendChild(s);
    });
    btn.appendChild(swatch);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPalette = p.name + ': ' + p.colors.join(', ');
    });
    $paletteGrid.appendChild(btn);
  });
}

function initStylePills() {
  $stylePills.querySelectorAll('.style-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      $stylePills.querySelectorAll('.style-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedStyle = pill.dataset.style;
    });
  });
}

// ─── LOAD IDEA ──────────────────────────────────────────────────────────────────
async function loadIdea() {
  try {
    const res = await fetch(`${API_BASE}/api/save/idea/${ideaId}`, { headers: headers() });
    const data = await res.json();
    if (data.idea) {
      ideaName = data.idea.ideaName || 'Your Idea';
      ideaText = data.idea.idea || '';
      $ideaName.textContent = ideaName;
      $ideaText.textContent = ideaText;
    } else {
      $ideaName.textContent = 'No idea found';
      $ideaText.classList.add('idea-card-empty');
      $ideaText.textContent = 'Go to Idea Hub to save an idea first.';
    }
  } catch (err) {
    console.error('Failed to load idea:', err);
    $ideaName.textContent = 'Error loading idea';
  }
}

// ─── CHECK EXISTING ─────────────────────────────────────────────────────────────
async function checkExisting() {
  try {
    const res = await fetch(`${API_BASE}/api/save/saveCobuilder2/${ideaId}`, { headers: headers() });
    const data = await res.json();
    if (data.cobuilder2 && data.cobuilder2.versions && data.cobuilder2.versions.length > 0) {
      const doc = data.cobuilder2;

      // If status is pending, poll
      if (doc.status === 'pending') {
        showLoading('Your page is being generated...');
        pollForCompletion();
        return;
      }

      versions = doc.versions.sort((a, b) => a.versionNumber - b.versionNumber);
      currentVersionIdx = versions.length - 1;
      showPreview();
      renderVersionBar();
      renderIframe(versions[currentVersionIdx].code);
    }
    // else: show setup panel (default)
  } catch (err) {
    console.error('checkExisting error:', err);
  }
}

async function pollForCompletion() {
  const poll = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/save/saveCobuilder2/${ideaId}`, { headers: headers() });
      const data = await res.json();
      if (data.cobuilder2 && data.cobuilder2.status !== 'pending') {
        clearInterval(poll);
        hideLoading();
        isLoading = false;
        $generateBtn.disabled = false;
        $editBtn.disabled = false;

        if (data.cobuilder2.status === 'success' && data.cobuilder2.versions.length > 0) {
          versions = data.cobuilder2.versions.sort((a, b) => a.versionNumber - b.versionNumber);
          currentVersionIdx = versions.length - 1;
          showPreview();
          renderVersionBar();
          renderIframe(versions[currentVersionIdx].code);
          showToast('Done!');
        } else if (data.cobuilder2.status === 'error') {
          showToast('Generation failed. Please try again.');
        }
      }
    } catch (_) {}
  }, 4000);
}

// ─── GENERATE ───────────────────────────────────────────────────────────────────
async function generate() {
  if (isLoading || !ideaText) return;
  isLoading = true;
  $generateBtn.disabled = true;
  showLoading('Building your landing page...');

  try {
    const res = await fetch(`${API_BASE}/api/responses/cobuilder2`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        idea: ideaText,
        ideaId,
        preferences: {
          colorScheme: selectedPalette,
          style: selectedStyle,
          additional: $additionalInput.value.trim()
        }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Generation failed');
    }

    // Backend returns immediately with { status: 'pending' }
    // Show preview area + loading, then poll DB until complete
    showPreview();
    pollForCompletion();
  } catch (err) {
    console.error('Generate error:', err);
    hideLoading();
    showToast('Generation failed: ' + err.message);
    isLoading = false;
    $generateBtn.disabled = false;
  }
}

// ─── EDIT ───────────────────────────────────────────────────────────────────────
async function applyEdit() {
  const instructions = $editInput.value.trim();
  if (!instructions || isLoading || currentVersionIdx < 0) return;

  isLoading = true;
  $editBtn.disabled = true;
  showLoading('Applying changes...');

  const currentCode = versions[currentVersionIdx].code;

  try {
    const res = await fetch(`${API_BASE}/api/responses/cobuilder2Edit`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ instructions, currentCode, ideaId })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Edit failed');
    }

    // Backend returns immediately with { status: 'pending' }
    // Poll until the edit is complete
    $editInput.value = '';
    pollForCompletion();
  } catch (err) {
    console.error('Edit error:', err);
    hideLoading();
    showToast('Edit failed: ' + err.message);
    isLoading = false;
    $editBtn.disabled = false;
  }
}

// ─── VERSION NAVIGATION ────────────────────────────────────────────────────────
function renderVersionBar() {
  $versionChips.innerHTML = '';
  versions.forEach((v, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'version-chip-wrap';

    const chip = document.createElement('button');
    chip.className = 'version-chip' + (idx === currentVersionIdx ? ' active' : '');
    chip.textContent = `v${v.versionNumber}`;
    chip.addEventListener('click', () => switchVersion(idx));

    const desc = document.createElement('div');
    desc.className = 'version-chip-desc';
    desc.textContent = v.description || 'Version ' + v.versionNumber;

    wrap.appendChild(desc);
    wrap.appendChild(chip);
    $versionChips.appendChild(wrap);
  });

  // Scroll to active chip
  const activeChip = $versionChips.querySelector('.version-chip.active');
  if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function switchVersion(idx) {
  if (idx < 0 || idx >= versions.length) return;
  currentVersionIdx = idx;
  renderVersionBar();
  renderIframe(versions[idx].code);
}

document.getElementById('versionPrev').addEventListener('click', () => switchVersion(currentVersionIdx - 1));
document.getElementById('versionNext').addEventListener('click', () => switchVersion(currentVersionIdx + 1));

// ─── IFRAME RENDERING ──────────────────────────────────────────────────────────
function renderIframe(html) {
  $previewIframe.srcdoc = html;
}

// ─── UI HELPERS ─────────────────────────────────────────────────────────────────
function showPreview() {
  $setupPanel.classList.add('hidden');
  $previewContainer.classList.add('active');
}

function showSetup() {
  $setupPanel.classList.remove('hidden');
  $previewContainer.classList.remove('active');
}

function showLoading(msg) {
  $loadingText.textContent = msg || 'Loading...';
  $loadingOverlay.classList.add('active');
}

function hideLoading() {
  $loadingOverlay.classList.remove('active');
}

function showToast(msg) {
  const $toast = document.getElementById('toast');
  $toast.textContent = msg;
  $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), 3000);
}

function cleanMarkdownFence(text) {
  if (!text) return text;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```\s*$/, '');
  return cleaned.trim();
}

// ─── ACTION BUTTONS ─────────────────────────────────────────────────────────────
document.getElementById('btnFullPreview').addEventListener('click', () => {
  if (currentVersionIdx < 0) return;
  const html = versions[currentVersionIdx].code;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
});

document.getElementById('btnCopyCode').addEventListener('click', () => {
  if (currentVersionIdx < 0) return;
  navigator.clipboard.writeText(versions[currentVersionIdx].code).then(() => showToast('Copied to clipboard!'));
});

document.getElementById('btnDownload').addEventListener('click', () => {
  if (currentVersionIdx < 0) return;
  const blob = new Blob([versions[currentVersionIdx].code], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ideaName.replace(/\s+/g, '-').toLowerCase()}-landing-page.html`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnNewPage').addEventListener('click', () => {
  if (isLoading) return;
  if (!confirm('Generate a new design? Your current versions will be kept.')) return;
  showSetup();
});

// ─── WAITLIST ───────────────────────────────────────────────────────────────────
const $waitlistOverlay = document.getElementById('waitlistOverlay');
const $waitlistBody = document.getElementById('waitlistBody');
const $waitlistCount = document.getElementById('waitlistCount');
const $waitlistEmpty = document.getElementById('waitlistEmpty');
const $waitlistTable = document.getElementById('waitlistTable');

document.getElementById('btnViewWaitlist').addEventListener('click', async () => {
  $waitlistOverlay.classList.add('active');
  $waitlistBody.innerHTML = '';
  $waitlistCount.textContent = 'Loading...';
  $waitlistEmpty.style.display = 'none';
  $waitlistTable.style.display = 'table';

  try {
    const res = await fetch(`${API_BASE}/api/waitlist/${ideaId}`, { headers: headers() });
    const data = await res.json();
    const entries = data.entries || [];

    $waitlistCount.textContent = `${entries.length} signup${entries.length !== 1 ? 's' : ''}`;

    if (entries.length === 0) {
      $waitlistTable.style.display = 'none';
      $waitlistEmpty.style.display = 'block';
      return;
    }

    entries.forEach(e => {
      const tr = document.createElement('tr');
      const d = new Date(e.createdAt);
      tr.innerHTML = `<td>${escHtml(e.subscriberName || '—')}</td><td>${escHtml(e.subscriberEmail)}</td><td>${d.toLocaleDateString()}</td>`;
      $waitlistBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Waitlist fetch error:', err);
    $waitlistCount.textContent = 'Failed to load';
  }
});

document.getElementById('waitlistClose').addEventListener('click', () => {
  $waitlistOverlay.classList.remove('active');
});

$waitlistOverlay.addEventListener('click', (e) => {
  if (e.target === $waitlistOverlay) $waitlistOverlay.classList.remove('active');
});

document.getElementById('btnExportCSV').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/api/waitlist/${ideaId}/csv`, { headers: headers() });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${ideaId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('CSV export error:', err);
    showToast('Export failed');
  }
});

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── EVENT LISTENERS ────────────────────────────────────────────────────────────
$generateBtn.addEventListener('click', generate);

$editBtn.addEventListener('click', applyEdit);

$editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    applyEdit();
  }
});

// ─── INIT ───────────────────────────────────────────────────────────────────────
(async function init() {
  initPalettes();
  initStylePills();
  await loadIdea();
  await checkExisting();
})();
