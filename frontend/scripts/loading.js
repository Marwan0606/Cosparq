// Calmer glow loop with cooldown + concurrency cap
const nodes = [...document.querySelectorAll('#nodes .node')].filter(n => n.id !== 'c');
const links = [...document.querySelectorAll('#links .link')];

const lastTime = new WeakMap();   // per-element cooldown
let active = 0;

// Tunables
const MAX_ACTIVE = 5;   // allow a few simultaneous glows
const COOLDOWN  = 900;  // ms before same element can glow again

function canPulse(el){
  if (!el) return false;
  const now  = performance.now();
  const last = lastTime.get(el) || 0;
  return (now - last) > COOLDOWN && active < MAX_ACTIVE;
}

function pulse(el, cls){
  if (!el || !canPulse(el)) return;
  active++;
  lastTime.set(el, performance.now());

  // restart animation if already running
  el.classList.remove(cls);
  // reflow to reset the animation
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add(cls);

  const done = () => {
    el.classList.remove(cls);
    active--;
  };
  el.addEventListener('animationend', done, { once: true });
}

// pick an element that isn't cooling down (try a few random candidates)
function pick(list){
  for (let i = 0; i < 6; i++){
    const candidate = list[Math.floor(Math.random() * list.length)];
    if (canPulse(candidate)) return candidate;
  }
  return null;
}

(function loop(){
  // Links + nodes glow (balanced)
  pulse(pick(links), 'glow');
  pulse(pick(nodes), 'glow');
  if (Math.random() > 0.4) pulse(pick(nodes), 'glow');

  // Slight cadence variation
  const next = 300 + Math.random() * 680; // 300–980ms
  setTimeout(loop, next);
})();
