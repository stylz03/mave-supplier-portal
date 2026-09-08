/* ============================================================
   MUREZA Supplier Portal — interface motion.

   Deliberately separate from js/scroll-film.js: that file returns
   early under prefers-reduced-motion, and the interface still needs
   its entrance and its scroll read-outs when the film is off.

   Three jobs:
     1. entrance stagger for the UI layer
     2. tier counters counting up
     3. progress line + rail counter wired to real scroll
   ============================================================ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. entrance -------------------------------------------
     Ordered roughly the way the eye travels: wordmark, header,
     hero copy, then the tier bar and the read-outs. 55ms apart —
     enough to read as a sequence, short enough that the whole
     interface has landed inside about a second. */
  const ORDER = [
    ".logo",
    ".brand",
    ".nav-link",
    ".cta",
    ".left-rule",
    ".kicker",
    ".headline",
    ".tagline",
    ".service",
    ".total-suppliers",
    ".hotspot",
    ".hotspot-label",
    ".rail-vertical",
    ".rail-count",
    ".explore",
    ".progress",
  ];

  let step = 0;
  for (const sel of ORDER) {
    for (const el of document.querySelectorAll(sel)) {
      el.classList.add("reveal");
      el.style.setProperty("--d", step * 55 + "ms");
      step += 1;
    }
  }

  /* Two frames: one for the class list to settle, one so the browser
     has painted the "from" state before it transitions.

     The timeout is not belt-and-braces — rAF is suspended entirely in
     a background tab, and without it a page opened in one would sit at
     opacity 0 with no interface at all until it was focused. */
  let released = false;
  function release() {
    if (released) return;
    released = true;
    document.documentElement.classList.add("is-ready");
  }
  requestAnimationFrame(() => requestAnimationFrame(release));
  setTimeout(release, 400);

  /* ---- 2. tier counters --------------------------------------
     The counts are the argument of the page — 50 partners across
     five tiers — so they arrive rather than just appear. Cubic
     ease-out: fast off the mark, settling on the final number. */
  function countUp(el, to, len, ms, delay) {
    const show = (v) => {
      el.textContent = String(v).padStart(len, "0");
    };
    if (reduce) {
      show(to);
      return;
    }
    show(0);
    let settled = false;
    const startAt = performance.now() + delay;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const frame = (now) => {
      if (settled) return;
      const t = Math.min(1, Math.max(0, (now - startAt) / ms));
      show(Math.round(ease(t) * to));
      if (t < 1) requestAnimationFrame(frame);
      else settled = true;
    };
    requestAnimationFrame(frame);
    /* Same reason as the entrance: in a background tab rAF never runs
       and the counters would read 00 forever. Land them on the real
       number instead. */
    setTimeout(() => {
      if (!settled) {
        settled = true;
        show(to);
      }
    }, delay + ms + 250);
  }

  document.querySelectorAll(".num, .tot-num").forEach((el, i) => {
    const raw = el.textContent.trim();
    const to = parseInt(raw, 10);
    if (!Number.isFinite(to)) return;
    countUp(el, to, raw.length, 1000, 520 + i * 90);
  });

  /* ---- 3. scroll read-outs -----------------------------------
     The progress line and the "01 / 04" rail were fixed decoration
     -- a progress bar that never moved. Wiring them to real scroll
     turns ornament into state indication. */
  const done = document.querySelector(".progress .done");
  const goldSeg = document.querySelector(".progress .gold-seg");
  const railCurrent = document.querySelector(".rail-current");
  const RAIL_TOTAL = 4;
  const SEG = 18.9; // gold segment width, % of track (matches CSS)

  const maxScroll = () =>
    Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  let lastRail = "";

  function readout() {
    const p = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    const pct = p * (100 - SEG);
    if (done) done.style.width = pct.toFixed(2) + "%";
    if (goldSeg) goldSeg.style.left = pct.toFixed(2) + "%";
    if (railCurrent) {
      const idx = Math.min(RAIL_TOTAL, Math.floor(p * RAIL_TOTAL) + 1);
      const s = String(idx).padStart(2, "0");
      if (s !== lastRail) {
        railCurrent.textContent = s;
        lastRail = s;
      }
    }
  }

  window.addEventListener("scroll", readout, { passive: true });
  window.addEventListener("resize", readout, { passive: true });
  readout();
})();
