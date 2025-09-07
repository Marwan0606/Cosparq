// scripts/loading.js

// Prevent double-start per container
const _startedFor = new WeakSet();

/**
 * Start the glow animation loop for the SVG inside `rootEl`.
 * Call this again whenever you re-inject the loading markup.
 * @param {Element|Document} rootEl - container that holds #nodes / #links
 */
export function startLoadingAnimation(rootEl = document) {
  if (!rootEl || _startedFor.has(rootEl)) return;
  _startedFor.add(rootEl);

  // Per-element cooldown tracking (scoped to this animation session)
  const lastTime = new WeakMap();
  let active = 0;

  // Tunables
  const MAX_ACTIVE = 5;   // allow a few simultaneous glows
  const COOLDOWN  = 900;  // ms before same element can glow again

  function canPulse(el) {
    if (!el) return false;
    const now  = performance.now();
    const last = lastTime.get(el) || 0;
    return (now - last) > COOLDOWN && active < MAX_ACTIVE;
  }

  function pulse(el, cls) {
    if (!el || !canPulse(el)) return;
    active++;
    lastTime.set(el, performance.now());

    // restart animation if already running
    el.classList.remove(cls);
    // reflow to reset the animation
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add(cls);

    el.addEventListener('animationend', () => {
      el.classList.remove(cls);
      active--;
    }, { once: true });
  }

  function pick(list) {
    for (let i = 0; i < 6; i++) {
      const candidate = list[Math.floor(Math.random() * list.length)];
      if (canPulse(candidate)) return candidate;
    }
    return null;
  }

  (function loop() {
    // Query fresh nodes/links each tick in case DOM changed
    const nodes = [...rootEl.querySelectorAll('#nodes .node')].filter(n => n.id !== 'c');
    const links = [...rootEl.querySelectorAll('#links .link')];

    if (nodes.length || links.length) {
      pulse(pick(links), 'glow');
      pulse(pick(nodes), 'glow');
      if (Math.random() > 0.4) pulse(pick(nodes), 'glow');
    }

    const next = 300 + Math.random() * 680; // 300–980ms
    setTimeout(loop, next);
  })();
}

// Auto-start for the first render on initial page load
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.js-scoreboard');
  if (container && (container.querySelector('#nodes') || container.querySelector('#links'))) {
    startLoadingAnimation(container);
  }
});
