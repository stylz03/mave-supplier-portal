/* ============================================================
   VANTA MOTORWORKS — scroll-driven hero film
   Maps scroll position to a pre-rendered image sequence:
   scrolling forward dismantles the car, scrolling back
   reassembles it. No libraries. Works over file://.
   ============================================================ */
(() => {
  "use strict";

  const FRAME_COUNT = 300;
  const FRAME_DIR = "assets/film/";
  const pad = (n) => String(n).padStart(4, "0");
  const frameSrc = (i) => FRAME_DIR + "frame_" + pad(i + 1) + ".jpg";

  const canvas = document.getElementById("film");
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
    cw = window.innerWidth;
    
    // Check if mobile portrait
    if (window.innerWidth < 900 && window.innerHeight > window.innerWidth) {
      ch = window.innerWidth * 0.85; // Force 85vw height to make hero block substantial
    } else {
      ch = window.innerHeight;
    }
    
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
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

  function overlays(p) {
    const live = anyReady && p > 0.002;
    canvas.style.opacity = live ? "1" : "0";
    if (carLayer) carLayer.style.opacity = live ? "0" : "1";
    if (word) word.style.opacity = "1";
    if (wordFront) wordFront.style.opacity = String(Math.min(1, p / 0.02));
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
