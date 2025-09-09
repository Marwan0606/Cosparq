// Scroll-driven text animations (no external libs).
// Multi-panel safe version: supports ANY number of .panel.focus and .panel.para-panel blocks.

(function () {
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- helpers ---
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Progress for a section/panel relative to viewport
  function progressFor(el, H) {
    const rect = el.getBoundingClientRect();
    const start = window.scrollY + rect.top;
    const end = start + el.offsetHeight - H;
    const den = Math.max(1, end - start);
    return clamp01((window.scrollY - start) / den);
  }

  // --- scrolly sections (expose --p and handle big word pan) ---
  const scrolly = Array.from(document.querySelectorAll('.scrolly'));
  function applySectionHeights() {
    scrolly.forEach((sec) => {
      const vh = parseFloat(sec.getAttribute('data-height') || '140');
      const h = Math.max(window.innerHeight, 1) * (vh / 100);
      sec.style.minHeight = h + 'px';
    });
  }

  // --- focus lines panels (multiple supported) ---
  const focusPanels = Array.from(document.querySelectorAll('.panel.focus')).map((panel) => ({
    panel,
    lines: Array.from(panel.querySelectorAll('.line')),
  }));

  // --- paragraph panels (multiple supported) ---
  const paraPanels = Array.from(document.querySelectorAll('.panel.para-panel')).map((panel) => ({
    panel,
    chunks: Array.from(panel.querySelectorAll('.chunk')),
  }));

  // --- main update loop (RAF throttled) ---
  let ticking = false;
  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function update() {
    const H = window.innerHeight || document.documentElement.clientHeight;

    // per scrolly section
    scrolly.forEach((sec) => {
      const p = prefersReduced ? 1 : progressFor(sec, H);
      sec.style.setProperty('--p', p.toFixed(4));

      // Big word horizontal pan inside this section
      if (sec.classList.contains('big')) {
        const track = sec.querySelector('.big-track');
        if (track) {
          const viewport = sec.querySelector('.big-viewport');
          const avail = viewport ? viewport.clientWidth : window.innerWidth;
          const overflow = Math.max(0, track.scrollWidth - avail);
          const x = -p * overflow;
          track.style.transform = `translate3d(${x}px,0,0)`;
        }
      }
    });

    // per focus panel
    focusPanels.forEach(({ panel, lines }) => {
      if (!lines.length) return;
      const p = prefersReduced ? 1 : progressFor(panel, H);
      const idx = Math.min(lines.length - 1, Math.floor(p * lines.length)); // <= important fix
      lines.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        const local = clamp01(p * lines.length - i);
        el.style.setProperty('--pLocal', local.toFixed(3));
      });
    });

    // per paragraph panel
    paraPanels.forEach(({ panel, chunks }) => {
      if (!chunks.length) return;
      const p = prefersReduced ? 1 : progressFor(panel, H);
      const idx = Math.min(chunks.length - 1, Math.floor(p * chunks.length));
      chunks.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        const local = clamp01(p * chunks.length - i);
        el.style.setProperty('--pChunk', local.toFixed(3));
      });
    });

    ticking = false;
  }

  // init
  applySectionHeights();
  update();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => {
    applySectionHeights();
    requestUpdate();
  });
  window.addEventListener('orientationchange', () => {
    applySectionHeights();
    requestUpdate();
  });
})();
