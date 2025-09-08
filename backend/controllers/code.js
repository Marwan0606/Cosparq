const { openai } = require('../services/openaiService');

const codePage = async (req, res) => {
  const { idea } = req.body;

  const messages = [
    {
      role: "system",
      content: `
      recreate this website https://cluely.com/ and also this website https://sintra.ai/?gad_source=1&gad_campaignid=22386630672&gbraid=0AAAAA_NXEDOtqQhqSR4nxL-dK8Frp-88X&gclid=CjwKCAjwt-_FBhBzEiwA7QEqyHcMjWPenzQK1gFRvRbhcmVTjKJ30_LFe0RVWhTOouo1-kQnGcIZvRoC1ggQAvD_BwE in html css and javascript
      You must create all the pages necessary for the website

      also here is code for a powerful website in that has a bunch of amazing animations, you can use some of these animations by taking it from this code file and adding it to the website you are creating. Use a minimum of 3 aniimations from this website code. Here is the code:

      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Advanced JavaScript Animations – Light Theme (No Smooth Scroll)</title>
  <style>
    /* -----------------------------
       Base styles & theme (Light)
    ------------------------------*/
    :root{
      /* Light base */
      --bg:#f6f9ff;        /* icy page background */
      --bg-2:#eef4ff;      /* subtle gradient stop */
      --bg-3:#ffffff;      /* surfaces */
      /* Text */
      --text:#0f1225;      /* near-black on light */
      --muted:#5e687f;     /* secondary copy */
      /* Accents */
      --brand:#7a58e8;     /* link/brand (deep lilac) */
      --accent:#DB9EE9;    /* primary accent (lilac) */
      --accent-2:#E2EDFD;  /* ice */
      /* Other */
      --ok:#2ea97d;
      --warn:#b58100;
      --shadow: 0 6px 30px rgba(13, 24, 48, .10);
      --radius:14px;
      --radius-sm:10px;
      --glass: rgba(20,30,60,.04);
      --glass-2: rgba(20,30,60,.08);
      --border: rgba(18,28,60,.12);
      --border-2: rgba(18,28,60,.18);
    }
    * { box-sizing:border-box }
    html, body { height:100% }
    /* NOTE: Smooth scrolling removed on purpose */
    /* Offset anchors for sticky nav */
    [id]{ scroll-margin-top: 72px }
    body{
      margin:0;
      font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      color:var(--text);
      background:
        radial-gradient(1200px 600px at 80% -100px, var(--bg-2) 0%, transparent 60%),
        radial-gradient(900px 500px at -10% 110%, rgba(219,158,233,.18) 0%, transparent 60%),
        var(--bg);
      overflow-x:hidden;
    }
    a { color: var(--brand); text-decoration: none }
    h1,h2,h3{ line-height:1.15; margin:0 0 .5rem }
    p{ margin:.5rem 0 1rem }
    .container{ width:min(1100px, 92vw); margin:0 auto; }
    .section{ padding: clamp(70px, 8vw, 120px) 0; position:relative }
    .muted{ color:var(--muted) }
    .chip{
      display:inline-block; padding:.35rem .7rem; border-radius:999px;
      background:var(--accent-2); color:var(--text); font-weight:700; letter-spacing:.3px;
      border:1px solid var(--border);
    }
    .button{
      display:inline-block; text-align:center;
      border:0;
      background:linear-gradient(180deg, var(--accent) 0%, #ba84d5 100%);
      color:#231a2a; font-weight:800; padding:.9rem 1.15rem; border-radius:12px; cursor:pointer;
      box-shadow: var(--shadow);
      transition: transform .15s ease, box-shadow .3s ease;
      position: relative; isolation:isolate;
    }
    .button:active{ transform: translateY(1px) scale(.99) }
    .grid{ display:grid; gap:clamp(16px,2vw,22px) }
    .grid.cols-2{ grid-template-columns: repeat(2, minmax(0,1fr)) }
    .grid.cols-3{ grid-template-columns: repeat(3, minmax(0,1fr)) }
    @media (max-width:900px){
      .grid.cols-2, .grid.cols-3{ grid-template-columns: 1fr }
    }
    .card{
      background: var(--bg-3);
      border:1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(6px);
    }
    .tag{ font-size: 12px; text-transform: uppercase; letter-spacing: .22em; color:var(--muted) }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace }

    /* -----------------------------
       Top nav + progress bar
    ------------------------------*/
    .nav{
      position: sticky; top:0; z-index: 1000; backdrop-filter: blur(10px);
      background: color-mix(in oklab, var(--bg-3) 80%, white);
      border-bottom:1px solid var(--border);
    }
    .nav-inner{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px }
    .nav a{ color:var(--text); opacity:.9; font-weight:700; margin:0 8px }
    .progress{ position:absolute; left:0; bottom:0; height:3px; background: linear-gradient(90deg, var(--accent), var(--brand)); width:0% }
    .right-actions{ display:flex; align-items:center; gap:10px }

    /* -----------------------------
       HERO
    ------------------------------*/
    .hero{
      display:grid; gap:22px; align-items:center;
      grid-template-columns: 1.2fr .8fr;
    }
    .hero .big{
      font-size: clamp(32px, 4vw, 52px);
      background: linear-gradient(180deg, #111, #3a3f55);
      -webkit-background-clip:text; background-clip:text;
      color:transparent;
    }
    .hero .sub{ font-size: clamp(16px, 2vw, 20px); color:var(--muted) }
    .hero-illus{
      height: 340px; border-radius: var(--radius);
      background:
        radial-gradient(180px 120px at 20% 20%, rgba(226,237,253,.8), transparent),
        radial-gradient(220px 140px at 80% 20%, rgba(219,158,233,.35), transparent),
        linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,.85));
      border: 1px solid var(--border);
      position: relative; overflow:hidden;
    }
    .orb{ position:absolute; width:110px; height:110px; border-radius:50%;
      background: radial-gradient(circle at 30% 30%, #fff, var(--accent) 40%, #ffd6ff 60%, transparent 70%);
      filter: blur(1px);
      mix-blend-mode: multiply;
      will-change: transform;
    }

    /* -----------------------------
       1) Infinite Seamless Marquee
    ------------------------------*/
    .marquee-wrap{
      position:relative; overflow:hidden; user-select:none;
      border:1px solid var(--border); border-radius: var(--radius);
      background: var(--bg-3);
    }
    .marquee{ display:flex; white-space:nowrap; gap: 40px; padding: 16px 0; }
    .marquee__inner{ display:inline-flex; gap:40px; padding-right:40px; will-change: transform; }
    .marquee-item{
      display:inline-flex; align-items:center; gap:10px;
      padding:.55rem .9rem; border-radius:999px;
      background: var(--accent-2);
      border:1px solid var(--border-2);
      font-weight:800; color: #1a2030;
    }
    .marquee-wrap:hover { cursor:pointer }
    .marquee-wrap:hover .marquee__inner { animation-play-state: paused }

    /* -----------------------------
       2) Parallax on scroll
    ------------------------------*/
    .parallax-box{
      height: 60vh; border-radius: var(--radius); overflow:hidden;
      background: linear-gradient(180deg, #ffffff, #f0f4ff);
      position:relative; border:1px solid var(--border);
    }
    .layer{ position:absolute; inset:0; background-size:cover; background-position:center; will-change: transform; }
    .layer.l1{ background-image:
      radial-gradient(120px 120px at 10% 10%, var(--accent-2), transparent),
      radial-gradient(140px 140px at 90% 30%, rgba(219,158,233,.45), transparent) }
    .layer.l2{ background-image: radial-gradient(220px 120px at 70% 80%, rgba(219,158,233,.22), transparent)}
    .layer.l3{ background-image: repeating-linear-gradient(60deg, rgba(12,18,38,.06) 0 2px, transparent 2px 10px); mix-blend-mode: multiply; }

    /* -----------------------------
       3) Reveal on scroll (IO)
    ------------------------------*/
    [data-reveal]{ opacity:0; transform: translateY(22px) scale(.98); transition: opacity .6s ease, transform .6s cubic-bezier(.2,.65,.2,1) }
    .is-visible{ opacity:1 !important; transform: none !important }

    /* -----------------------------
       4) Sticky timeline
    ------------------------------*/
    .timeline{ display:grid; grid-template-columns: .9fr 1.1fr; gap: 28px }
    .timeline .left{ position:sticky; top:90px; align-self:start }
    .milestone{
      padding:18px; border-radius: var(--radius-sm);
      background: var(--bg-3);
      border:1px solid var(--border);
    }

    /* -----------------------------
       5) Horizontal gallery driven by vertical scroll
    ------------------------------*/
    .hscroll-section{ height: 180vh; position:relative }
    .hscroll-sticky{
      position: sticky; top:0; height:100vh; display:flex; align-items:center; overflow:hidden;
      border-radius: var(--radius); border:1px solid var(--border);
      background: var(--bg-3);
    }
    .htrack{ display:flex; align-items:stretch; gap: 18px; padding: 40px; will-change: transform; min-width: 100% }
    .frame{
      flex:0 0 68vw; height: 70vh; border-radius: 16px; position:relative; overflow:hidden;
      background: linear-gradient(135deg, #ffffff, #f2f5ff);
      border:1px solid var(--border);
    }
    .frame::after{ content:""; position:absolute; inset:0; background: radial-gradient(80% 60% at 50% 0%, rgba(122,88,232,.08), transparent); pointer-events:none }
    .frame .label{ position:absolute; left:16px; bottom:14px; background:rgba(255,255,255,.8); padding:.35rem .6rem; border-radius:8px; font-weight:800; border:1px solid var(--border) }

    /* -----------------------------
       6) Sticky cards
    ------------------------------*/
    .cards{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 18px }
    @media (max-width:900px){ .cards{ grid-template-columns: 1fr } }
    .sticky-card{ position: sticky; top: 100px; min-height: 220px; display:flex; flex-direction:column; gap:.6rem; justify-content:space-between }

    /* -----------------------------
       7) Magnetic buttons & 3D tilt cards
    ------------------------------*/
    .playground{ display:flex; flex-wrap:wrap; gap:20px; align-items:center }
    .magnet{
      --r: 18px;
      border-radius: var(--r); padding: 14px 18px;
      background: linear-gradient(180deg, rgba(226,237,253,.70), rgba(226,237,253,.35));
      border:1px solid var(--border-2);
      color:#1a2030;
      font-weight:900; letter-spacing:.4px; cursor:pointer; position:relative;
      transition: transform .15s ease;
      will-change: transform;
    }
    .tilt{
      width: clamp(240px, 30vw, 360px); height: 200px; border-radius: 16px; position:relative; overflow:hidden;
      background:
        radial-gradient(220px 160px at 20% 20%, rgba(219,158,233,.28), transparent 60%),
        linear-gradient(180deg, #ffffff, #f3f6ff);
      border:1px solid var(--border);
      transform-style: preserve-3d;
      perspective: 800px;
    }
    .tilt .inner{ position:absolute; inset:0; display:grid; place-items:center; transform: translateZ(40px); font-weight:900; font-size: 26px; text-shadow: 0 3px 12px rgba(0,0,0,.12); color:#222 }

    /* -----------------------------
       8) Scroll snap demo
    ------------------------------*/
    .snap-shell{
      border:1px solid var(--border); border-radius: var(--radius);
      height: 70vh; overflow:auto; scroll-snap-type: y mandatory;
      background: var(--bg-3);
    }
    .snap-item{
      height:70vh; display:grid; place-items:center; scroll-snap-align: start;
      font-size: clamp(28px, 4vw, 42px); font-weight: 900;
      background: linear-gradient(135deg, rgba(219,158,233,.16), rgba(226,237,253,.60));
      color:#1a2030;
    }

    /* -----------------------------
       9) Typewriter & CountUp styles
    ------------------------------*/
    .type-shell{
      display:flex; align-items:center; gap:.6rem; font-weight:900;
      font-size: clamp(22px, 3.2vw, 34px);
      padding: 18px;
      border-radius: var(--radius);
      border:1px solid var(--border);
      background: var(--bg-3);
      min-height: 76px;
    }
    .caret{ width: 2px; align-self:stretch; background: currentColor; animation: blink 1s steps(1) infinite; opacity:.9 }
    @keyframes blink { 50% { opacity: 0 } }

    /* Trimmed counters: 2 columns, stack to 1 on small screens */
    .counters{ display:grid; grid-template-columns: repeat(2, 1fr); gap: 16px }
    @media (max-width:700px){ .counters{ grid-template-columns: 1fr } }
    .counter-card{
      padding: 18px; border-radius: var(--radius);
      background: var(--bg-3);
      border:1px solid var(--border);
    }
    .count{ font-size: clamp(28px, 4vw, 44px); font-weight: 900; letter-spacing:.02em; word-break: break-word }

    /* -----------------------------
       Footer
    ------------------------------*/
    .foot{ color:var(--muted); text-align:center; padding:40px 0 80px }

    /* Reduced motion preference */
    @media (prefers-reduced-motion: reduce){
      .marquee__inner, .layer, [data-reveal], .htrack, .orb, .magnet, .tilt, .caret{ transition:none !important; animation:none !important }
    }
  </style>
</head>
<body>

  <!-- Sticky nav with progress bar -->
  <div class="nav">
    <div class="nav-inner container">
      <div style="display:flex; align-items:center; gap:10px">
        <span class="chip">JS Anim Pack</span>
      </div>
      <div class="right-actions">
        <a href="#marquee">Marquee</a>
        <a href="#parallax">Parallax</a>
        <a href="#reveal">Reveal</a>
        <a href="#timeline">Sticky</a>
        <a href="#hscroll">H-Scroll</a>
        <a href="#playground">Play</a>
        <a href="#snap">Snap</a>
        <a href="#text">Type & Count</a>
        <!-- Smooth toggle removed -->
      </div>
    </div>
    <div class="progress" id="progress"></div>
  </div>

  <!-- HERO -->
  <section class="section">
    <div class="container hero">
      <div>
        <div class="tag">Advanced JavaScript Animations</div>
        <h1 class="big">A curated pack of <em>smooth</em> marquee, scroll magic, sticky timelines, parallax layers and juicy micro-interactions.</h1>
        <p class="sub">No external libraries required. Everything is written with modern, performant patterns:
          <span class="mono">requestAnimationFrame</span>, <span class="mono">IntersectionObserver</span>,
          CSS <span class="mono">position: sticky</span>, and hardware-accelerated transforms.
        </p>
        <div class="playground" style="margin-top:12px">
          <a class="button" href="#marquee">Jump to Demos ↓</a>
          <button class="magnet">I’m Magnetic</button>
        </div>
      </div>
      <div class="hero-illus">
        <div class="orb" id="orb1" style="left:16%; top:12%"></div>
        <div class="orb" id="orb2" style="right:8%; top:28%; width:80px; height:80px"></div>
        <div class="orb" id="orb3" style="left:30%; bottom:8%; width:140px; height:140px"></div>
      </div>
    </div>
  </section>

  <!-- 1) MARQUEE -->
  <section class="section" id="marquee">
    <div class="container">
      <h2>1) Infinite Seamless Marquee</h2>
      <p class="muted">Seamless, rAF-driven marquee that adapts to width, respects reduced-motion, pauses on hover, and supports multiple speed layers.</p>
      <div class="marquee-wrap card" data-speed="70">
        <div class="marquee">
          <div class="marquee__inner">
            <span class="marquee-item">Seamless</span>
            <span class="marquee-item">Ultra Smooth</span>
            <span class="marquee-item">GPU Accelerated</span>
            <span class="marquee-item">Hover to Pause</span>
            <span class="marquee-item">RTL & LTR</span>
            <span class="marquee-item">Dynamic Width</span>
            <span class="marquee-item">Insane</span>
            <span class="marquee-item">Advanced</span>
            <span class="marquee-item">JavaScript</span>
            <span class="marquee-item">Animations</span>
          </div>
        </div>
      </div>

      <div class="marquee-wrap card" style="margin-top:14px" data-speed="120" data-direction="-1">
        <div class="marquee">
          <div class="marquee__inner">
            <span class="marquee-item">Layered</span>
            <span class="marquee-item">Faster Track</span>
            <span class="marquee-item">Custom Speed</span>
            <span class="marquee-item">Reversible</span>
            <span class="marquee-item">Ridiculously Smooth</span>
            <span class="marquee-item">requestAnimationFrame</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 2) PARALLAX -->
  <section class="section" id="parallax">
    <div class="container">
      <h2>2) Parallax Layers on Scroll</h2>
      <p class="muted">Three layers moving at different speeds via <span class="mono">transform: translateY</span> and a throttled rAF scroll loop.</p>
      <div class="parallax-box card" data-parallax>
        <div class="layer l1" data-speed="0.35"></div>
        <div class="layer l2" data-speed="0.18"></div>
        <div class="layer l3" data-speed="-0.08"></div>
      </div>
    </div>
  </section>

  <!-- 3) REVEAL -->
  <section class="section" id="reveal">
    <div class="container">
      <h2>3) Scroll Reveal (IntersectionObserver)</h2>
      <p class="muted">Elements fade/slide in when entering the viewport—efficient and battery friendly.</p>
      <div class="grid cols-3">
        <div class="card" data-reveal>
          <div class="tag">Feature</div>
          <h3>IntersectionObserver</h3>
          <p>Observe once, then unobserve; CSS handles the transition.</p>
        </div>
        <div class="card" data-reveal>
          <div class="tag">Performance</div>
          <h3>Minimal Work</h3>
          <p>No per-frame math—just class toggles.</p>
        </div>
        <div class="card" data-reveal>
          <div class="tag">A11y</div>
          <h3>Reduced Motion</h3>
          <p>Respects <span class="mono">prefers-reduced-motion</span>.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 4) STICKY TIMELINE -->
  <section class="section" id="timeline">
    <div class="container timeline">
      <div class="left">
        <h2>4) Sticky Timeline</h2>
        <p class="muted">The left column sticks while the right column scrolls through milestones.</p>
      </div>
      <div class="right grid">
        <div class="milestone" data-reveal>
          <div class="tag">Phase 1</div>
          <h3>Design</h3>
          <p>Wireframes, flows, prototypes.</p>
        </div>
        <div class="milestone" data-reveal>
          <div class="tag">Phase 2</div>
          <h3>Build</h3>
          <p>Components, state, APIs.</p>
        </div>
        <div class="milestone" data-reveal>
          <div class="tag">Phase 3</div>
          <h3>Polish</h3>
          <p>Micro-interactions, perf, a11y.</p>
        </div>
        <div class="milestone" data-reveal>
          <div class="tag">Phase 4</div>
          <h3>Ship</h3>
          <p>QA, observability, rollout.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 5) HORIZONTAL SCROLL CONTROLLED BY VERTICAL -->
  <section class="section hscroll-section" id="hscroll">
    <div class="hscroll-sticky container">
      <div class="htrack" id="htrack">
        <div class="frame"><span class="label">Frame 1</span></div>
        <div class="frame"><span class="label">Frame 2</span></div>
        <div class="frame"><span class="label">Frame 3</span></div>
        <div class="frame"><span class="label">Frame 4</span></div>
        <div class="frame"><span class="label">Frame 5</span></div>
      </div>
    </div>
  </section>

  <!-- 6) STICKY CARDS -->
  <section class="section">
    <div class="container">
      <h2>6) Sticky Cards</h2>
      <p class="muted">Each card sticks as it reaches the top—great for storytelling.</p>
      <div class="cards">
        <div class="card sticky-card" data-reveal>
          <h3>Sticky Card One</h3>
          <p>Position: sticky; top: 100px.</p>
          <p class="muted mono">No JS required.</p>
        </div>
        <div class="card sticky-card" data-reveal>
          <h3>Sticky Card Two</h3>
          <p>Stacks and peels away as you scroll.</p>
          <p class="muted mono">Compositional layouts.</p>
        </div>
        <div class="card sticky-card" data-reveal>
          <h3>Sticky Card Three</h3>
          <p>Pair with progress indicators.</p>
          <p class="muted mono">Elegant storytelling.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 7) PLAYGROUND: MAGNETIC BUTTONS & 3D TILT -->
  <section class="section" id="playground">
    <div class="container">
      <h2>7) Magnetic Buttons + 3D Tilt Cards</h2>
      <p class="muted">Pointer-following “magnet” effect and 3D tilt parallax—powered by mouse/touch events and transforms.</p>
      <div class="playground">
        <button class="magnet">Magnet A</button>
        <button class="magnet">Magnet B</button>
        <div class="tilt card">
          <div class="inner">3D Tilt</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 8) SCROLL SNAP -->
  <section class="section" id="snap">
    <div class="container">
      <h2>8) Scroll Snap</h2>
      <p class="muted">CSS-only snapping container. Easy, smooth section-to-section browsing.</p>
      <div class="snap-shell">
        <div class="snap-item">Snap 1</div>
        <div class="snap-item">Snap 2</div>
        <div class="snap-item">Snap 3</div>
      </div>
    </div>
  </section>

  <!-- 9) TYPEWRITER + COUNTUP (trimmed to 2 items) -->
  <section class="section" id="text">
    <div class="container">
      <h2>9) Typewriter + CountUp</h2>
      <p class="muted">Looping typewriter with blink caret and counters that animate when they enter the viewport.</p>

      <div class="grid cols-2">
        <!-- Typewriter -->
        <div class="card">
          <div class="tag">Typewriter</div>
          <div class="type-shell">
            <span id="typewriter" aria-live="polite"></span>
            <span class="caret" aria-hidden="true"></span>
          </div>
          <p class="muted" style="margin-top:.6rem">Edit the word list in JS to customize phrases.</p>
        </div>

        <!-- CountUp (trimmed) -->
        <div class="card">
          <div class="tag">CountUp</div>
          <div class="counters" style="margin-top:.6rem">
            <div class="counter-card" data-reveal>
              <div class="muted">Users</div>
              <div class="count" data-countup data-to="128740" data-duration="1400"></div>
            </div>
            <div class="counter-card" data-reveal>
              <div class="muted">MRR</div>
              <div class="count" data-countup data-prefix="$" data-to="43210.75" data-decimals="2" data-duration="1600"></div>
            </div>
          </div>
          <p class="muted" style="margin-top:.6rem">Supports <span class="mono">data-prefix</span>, <span class="mono">data-suffix</span>, <span class="mono">data-decimals</span>, and <span class="mono">data-duration</span>.</p>
        </div>
      </div>
    </div>
  </section>

  <div class="foot">
    Built with ❤️ for performance and flair. Light theme; smooth scrolling removed.
  </div>

<script>
// =====================================================
// Utilities
// =====================================================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, n) => (1 - n) * a + n * b;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// =====================================================
// 0) Global Scroll Progress Bar
// =====================================================
(() => {
  const el = document.getElementById('progress');
  const update = () => {
    const scroll = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = (scroll / h) * 100;
    el.style.width = pct + '%';
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
})();

// =====================================================
/* 1) Infinite Seamless Marquee */
// =====================================================
(() => {
  if(prefersReduced) return;

  class Marquee {
    constructor(wrapper){
      this.wrapper = wrapper;
      this.inner = wrapper.querySelector('.marquee__inner');
      this.speed = parseFloat(wrapper.dataset.speed || '80'); // px/sec
      this.dir = parseInt(wrapper.dataset.direction || '1', 10);
      this.pos = 0;
      this.width = 0;
      this.playing = true;
      this._frame = this._frame.bind(this);
      this._onResize = this._onResize.bind(this);
      this._init();
    }
    _init(){
      const content = this.inner.innerHTML;
      this.inner.innerHTML = content + content;
      this._onResize();
      this.wrapper.addEventListener('mouseenter', () => { this.playing = false; });
      this.wrapper.addEventListener('mouseleave', () => { this.playing = true; });
      requestAnimationFrame(this._frame);
      window.addEventListener('resize', this._onResize);
    }
    _onResize(){
      this.inner.style.transform = 'translate3d(0,0,0)';
      this.width = this.inner.scrollWidth / 2;
      this.pos = this.pos % this.width;
    }
    _frame(){
      if(this.playing){
        const delta = (this.speed / 60) * this.dir;
        this.pos = (this.pos + delta) % this.width;
        this.inner.style.transform = \`translate3d(\\\${-this.pos}px,0,0)\`;
      }
      requestAnimationFrame(this._frame);
    }
  }
  document.querySelectorAll('.marquee-wrap').forEach(w => new Marquee(w));
})();

// =====================================================
/* 2) Parallax Layers */
// =====================================================
(() => {
  const boxes = [...document.querySelectorAll('[data-parallax]')];
  if(!boxes.length || prefersReduced) return;

  let ticking = false;
  const onScroll = () => {
    if(!ticking){
      requestAnimationFrame(update);
      ticking = true;
    }
  };
  const update = () => {
    const vh = window.innerHeight;
    boxes.forEach(box => {
      const rect = box.getBoundingClientRect();
      const center = rect.top + rect.height/2 - vh/2;
      const layers = box.querySelectorAll('[data-speed]');
      layers.forEach(layer => {
        const speed = parseFloat(layer.getAttribute('data-speed'));
        const y = clamp(-center * speed * 0.02, -60, 60);
        layer.style.transform = \`translate3d(0, \\\${y}px, 0)\`;
      });
    });
    ticking = false;
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
})();

// =====================================================
/* 3) IntersectionObserver reveal */
// =====================================================
(() => {
  const targets = document.querySelectorAll('[data-reveal]');
  if(!targets.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
})();

// =====================================================
/* 4) Hero Orbs floating subtly */
// =====================================================
(() => {
  if(prefersReduced) return;
  const orbs = [document.getElementById('orb1'), document.getElementById('orb2'), document.getElementById('orb3')].filter(Boolean);
  let t = 0;
  const loop = () => {
    t += 0.01;
    orbs.forEach((el, i) => {
      const dx = Math.sin(t + i) * 6;
      const dy = Math.cos(t*1.2 + i*0.7) * 6;
      el.style.transform = \`translate3d(\\\${dx}px, \\\${dy}px, 0)\`;
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();

// =====================================================
/* 5) Horizontal gallery controlled by vertical scroll */
// =====================================================
(() => {
  if(prefersReduced) return;
  const section = document.querySelector('.hscroll-section');
  const track = document.getElementById('htrack');
  if(!section || !track) return;

  const frames = [...track.children];
  let trackW = 0;
  const gap = 18;
  const recalc = () => {
    const widths = frames.map(f => f.getBoundingClientRect().width);
    trackW = widths.reduce((a,b)=>a+b,0) + gap*(frames.length-1);
  };
  const update = () => {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = clamp(-rect.top, 0, total);
    const progress = total <= 0 ? 0 : scrolled/total;
    const maxTranslate = Math.max(0, trackW - window.innerWidth);
    const x = -progress * maxTranslate;
    track.style.transform = \`translate3d(\\\${x}px,0,0)\`;
  };
  const onScroll = () => requestAnimationFrame(update);
  window.addEventListener('resize', () => { recalc(); update(); }, { passive:true });
  window.addEventListener('scroll', onScroll, { passive:true });
  recalc(); update();
})();

// =====================================================
/* 6) Magnetic buttons */
// =====================================================
(() => {
  const magnets = document.querySelectorAll('.magnet');
  if(!magnets.length) return;
  magnets.forEach(btn => {
    const strength = 40; // px
    const onMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const mx = e.clientX ?? (e.touches && e.touches[0].clientX);
      const my = e.clientY ?? (e.touches && e.touches[0].clientY);
      if(mx == null) return;
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = mx - cx;
      const dy = my - cy;
      const dist = Math.hypot(dx, dy);
      const pull = clamp(1 - dist / 220, 0, 1);
      const tx = clamp(dx * 0.2 * pull, -strength, strength);
      const ty = clamp(dy * 0.2 * pull, -strength, strength);
      btn.style.transform = \`translate3d(\\\${tx}px, \\\${ty}px, 0)\`;
    };
    const reset = () => { btn.style.transform = 'translate3d(0,0,0)' };
    window.addEventListener('mousemove', onMove, { passive:true });
    window.addEventListener('touchmove', onMove, { passive:true });
    btn.addEventListener('mouseleave', reset);
    btn.addEventListener('blur', reset);
  });
})();

// =====================================================
/* 7) 3D Tilt card */
// =====================================================
(() => {
  const tilt = document.querySelector('.tilt');
  if(!tilt) return;
  const inner = tilt.querySelector('.inner');
  const onMove = (e) => {
    const rect = tilt.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
    const rx = clamp((.5 - y/rect.height) * 12, -12, 12);
    const ry = clamp((x/rect.width - .5) * 18, -18, 18);
    tilt.style.transform = \`perspective(800px) rotateX(\\\${rx}deg) rotateY(\\\${ry}deg)\`;
    inner.style.transform = \`translateZ(60px)\`;
  };
  const reset = () => {
    tilt.style.transform = 'perspective(800px) rotateX(0) rotateY(0)';
  };
  tilt.addEventListener('mousemove', onMove, { passive:true });
  tilt.addEventListener('touchmove', onMove, { passive:true });
  tilt.addEventListener('mouseleave', reset);
  tilt.addEventListener('touchend', reset);
})();

// =====================================================
// 8) TYPEWRITER (looping, variable speeds)
// =====================================================
(() => {
  const el = document.getElementById('typewriter');
  if(!el) return;

  const words = [
    'Hyper-smooth UI.',
    'JavaScript sorcery.',
    'Pixels with personality.',
    'Marquee. Parallax. Magic.'
  ];

  if(prefersReduced){
    el.textContent = words[0];
    return;
  }

  let w = 0, i = 0, deleting = false;
  let last = performance.now();
  let acc = 0;
  const typeSpeed = 70;     // ms per char
  const deleteSpeed = 36;   // ms per char
  const holdTime = 1000;    // ms pause on full word
  let holdAcc = 0;

  const tick = (now) => {
    const dt = now - last; last = now;
    if(!deleting){
      if(i < words[w].length){
        acc += dt;
        if(acc >= typeSpeed){
          i++;
          el.textContent = words[w].slice(0, i);
          acc = 0;
        }
      } else {
        holdAcc += dt;
        if(holdAcc >= holdTime){
          deleting = true;
          holdAcc = 0;
        }
      }
    } else {
      if(i > 0){
        acc += dt;
        if(acc >= deleteSpeed){
          i--;
          el.textContent = words[w].slice(0, i);
          acc = 0;
        }
      } else {
        deleting = false;
        w = (w + 1) % words.length;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

// =====================================================
// 9) COUNTUP (IO-triggered, decimals, prefix/suffix)
// =====================================================
(() => {
  const els = [...document.querySelectorAll('[data-countup]')];
  if(!els.length) return;

  const formatNumber = (num, decimals=0) => {
    return Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const animateTo = (el) => {
    const to = parseFloat(el.dataset.to || '0');
    const duration = parseInt(el.dataset.duration || '1200', 10);
    const decimals = parseInt(el.dataset.decimals || (String(to).includes('.') ? String(to).split('.')[1].length : 0), 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const from = parseFloat(el.dataset.from || '0');

    if(prefersReduced || duration <= 0){
      el.textContent = prefix + formatNumber(to, decimals) + suffix;
      return;
    }

    let start = null;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (ts) => {
      if(!start) start = ts;
      const p = clamp((ts - start) / duration, 0, 1);
      const eased = easeOutCubic(p);
      const current = from + (to - from) * eased;
      el.textContent = prefix + formatNumber(current, decimals) + suffix;
      if(p < 1) requestAnimationFrame(step);
      else el.textContent = prefix + formatNumber(to, decimals) + suffix; // snap
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateTo(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });

  els.forEach(el => {
    const initFrom = parseFloat(el.dataset.from || '0');
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    el.textContent = prefix + (prefersReduced ? formatNumber(parseFloat(el.dataset.to || '0'), decimals) : formatNumber(initFrom, decimals)) + suffix;
    io.observe(el);
  });
})();

/* 10) Smooth scrolling feature REMOVED */
</script>

</body>
</html>



      Formatting instructions:
      - Return only the fully self-contained HTML file.
      - Wrap your entire output in a single Markdown code block with html at the top and at the bottom.
      - Do not include any explanation or extra text.
      `
    },
    {
      role: "user",
      content: idea
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      //reasoning_effort:"high"
      //temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { codePage };
