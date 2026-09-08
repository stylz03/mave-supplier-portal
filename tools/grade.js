/* ============================================================
   Grade-match generated images to the existing film.

   Generation varies shot to shot; the site's look does not. This
   solves for the gamma that lands an image on the reference mean
   luma, then bakes it in (STUDY.md §8 — grade lives in the image,
   never in a CSS filter).

   Reference, measured from assets/film/: mean 76, min 1, max 229.

     node grade.js in.png                     # -> out/graded/in.jpg
     node grade.js --target 76 --out DIR a.png b.png
     node grade.js --check a.png              # report only, no write
   ============================================================ */
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("ffmpeg-static");

const REFERENCE_MEAN = 76;

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf("--" + name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const target = Number(opt("target", REFERENCE_MEAN));
const outDir = path.resolve(opt("out", path.join(__dirname, "out", "graded")));
const width = Number(opt("width", 1920));
const height = Number(opt("height", 1080));
const quality = Number(opt("quality", 4));
const checkOnly = flag("check");
const files = args.filter((a) => !a.startsWith("--"));

if (!files.length) {
  console.error("usage: node grade.js [--target N] [--out DIR] [--check] <images...>");
  process.exit(1);
}

/* Mean luma of a file, optionally with a gamma applied. Sampled at
   192x108 — enough for a stable mean, fast enough to binary search. */
function meanLuma(file, gamma) {
  const vf =
    "scale=192:108" + (gamma && gamma !== 1 ? `,eq=gamma=${gamma.toFixed(4)}` : "") + ",format=gray";
  const buf = execFileSync(ffmpeg, ["-v", "error", "-i", file, "-vf", vf, "-f", "rawvideo", "-"], {
    maxBuffer: 1e8,
  });
  let s = 0;
  for (const v of buf) s += v;
  return s / buf.length;
}

function solveGamma(file) {
  let lo = 0.4,
    hi = 3.0;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (meanLuma(file, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`skip (missing): ${f}`);
    continue;
  }
  const before = meanLuma(f, 1);
  const gamma = solveGamma(f);
  const after = meanLuma(f, gamma);

  if (checkOnly) {
    console.log(
      `${path.basename(f)}  mean ${before.toFixed(1)} -> would need gamma ${gamma.toFixed(3)} (target ${target})`
    );
    continue;
  }

  const dest = path.join(outDir, path.basename(f).replace(/\.[^.]+$/, "") + ".jpg");
  execFileSync(ffmpeg, [
    "-v", "error", "-y", "-i", f,
    "-vf",
    `eq=gamma=${gamma.toFixed(4)},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
    "-q:v", String(quality),
    dest,
  ]);
  console.log(
    `${path.basename(f)}  mean ${before.toFixed(1)} -> ${after.toFixed(1)}  (gamma ${gamma.toFixed(3)})  ${dest}`
  );
}
