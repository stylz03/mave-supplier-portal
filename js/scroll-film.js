/* ============================================================
   VANTA MOTORWORKS — scroll-driven hero film
   Maps scroll position to a pre-rendered image sequence:
   scrolling forward dismantles the car, scrolling back
   reassembles it. No libraries. Works over file://.
   ============================================================ */
(() => {
  "use strict";

  const canvas = document.getElementById("film");

  /* Sequence is described by the canvas so a new vehicle render can be
     dropped in without touching this file: data-frames / data-dir /
     data-prefix / data-ext on #film. */
  const cfg = canvas ? canvas.dataset : {};
  const FRAME_COUNT = Number(cfg.frames) || 240;
  const FRAME_DIR = cfg.dir || "assets/film-van/";
  const FRAME_PREFIX = cfg.prefix || "frame_";
  const FRAME_EXT = cfg.ext || ".jpg";
  const pad = (n) => String(n).padStart(4, "0");
  const frameSrc = (i) => FRAME_DIR + FRAME_PREFIX + pad(i + 1) + FRAME_EXT;

  const word = document.querySelector(".display-word");
  const carLayer = document.querySelector(".car-layer");
  const wordFront = document.getElementById("wordFront");
  if (!canvas || FRAME_COUNT < 2) return;
  const ctx = canvas.getContext("2d");

  /* ---- scrub state ---- */
  let target = 0;      
  let current = 0;     
  let needsDraw = true;
  let lastT = performance.now();
  let lastFrame = -1;
  let frozen = false;  

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("no-film");
    return;
  }

  const frames = new Array(FRAME_COUNT).fill(null);
  const ready = new Array(FRAME_COUNT).fill(false);
  let anyReady = false;

  function load(i) {
    const img = new Image();
    img.onload = () => {
      frames[i] = img;
      ready[i] = true;
      anyReady = true;
      needsDraw = true;
      if (frozen) render();
    };
    img.src = frameSrc(i);
  }
  load(0);
  setTimeout(() => {
    for (let i = 1; i < FRAME_COUNT; i++) load(i);
  }, 60);

  function nearestReady(i) {
    if (ready[i]) return i;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < FRAME_COUNT && ready[i + d]) return i + d;
    }
    return -1;
  }

  let cw = 0, ch = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* Measure the box CSS actually gave us instead of recomputing it.
       The mobile hero height is a stylesheet decision; duplicating the
       ratio here meant the canvas and its own CSS box could drift out
       of step whenever one of them changed. */
    const rect = canvas.getBoundingClientRect();
    cw = Math.round(rect.width) || window.innerWidth;
    ch = Math.round(rect.height) || window.innerHeight;

    /* Only the backing store is set here. Writing style.width/height
       too would pin the box to inline values and the next measure would
       read those back instead of the stylesheet — CSS would stop
       mattering after the first resize. */
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    needsDraw = true;
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  function draw(img) {
    if (!img) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max((cw * dpr) / iw, (ch * dpr) / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (cw * dpr - dw) / 2, dy = (ch * dpr - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  const maxScroll = () =>
    Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  const smoothstep = (p) => p * p * (3 - 2 * p);

  function readScroll() {
    target = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
  }
  window.addEventListener("scroll", () => { readScroll(); }, { passive: true });
  readScroll();

  /* The display word drifts up and opens out as the film runs, so the type
     reads as part of the scene rather than a sticker on top of it. Small
     numbers on purpose: this should register as depth, not as movement. */
  function wordStyle(el, p) {
    if (!el) return;
    el.style.transform =
      `translate3d(0, ${(-p * 3.4).toFixed(3)}vh, 0) scale(${(1 + p * 0.085).toFixed(4)})`;
    el.style.letterSpacing = `${(0.23 + p * 0.05).toFixed(4)}em`;
  }

  function overlays(p) {
    const live = anyReady && p > 0.002;
    canvas.style.opacity = live ? "1" : "0";
    if (carLayer) carLayer.style.opacity = live ? "0" : "1";
    if (word) word.style.opacity = "1";
    if (wordFront) wordFront.style.opacity = String(Math.min(1, p / 0.02));

    /* Both copies move together so the hand-off between the behind-car
       copy and the above-film copy stays invisible. */
    wordStyle(word, p);
    wordStyle(wordFront, p);
  }

  function render() {
    const t = smoothstep(Math.min(1, Math.max(0, current)));
    const want = Math.min(FRAME_COUNT - 1, Math.round(t * (FRAME_COUNT - 1)));
    const idx = anyReady ? nearestReady(want) : -1;

    if (needsDraw || idx !== lastFrame) {
      if (idx >= 0) {
        draw(frames[idx]);
        lastFrame = idx;
      }
      needsDraw = false;
    }
    overlays(current);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;

    if (!frozen) {
      const k = 1 - Math.exp(-dt * 7);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0004) current = target;
    }

    render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  render();
})();
