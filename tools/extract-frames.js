/* ============================================================
   Video clips -> the numbered JPG sequence the site expects.

   Takes any number of clips in order, extracts frames at a fixed
   rate, scales/crops to 1920x1080 and writes one continuously
   numbered run: frame_0001.jpg, frame_0002.jpg, ...

   Usage:
     node extract-frames.js --out ../assets/film-van \
                            --fps 24 --quality 4 \
                            clip1.mp4 clip2.mp4 clip3.mp4

   Then point the canvas at it in index.html:
     data-frames="<count printed at the end>" data-dir="assets/film-van/"
   ============================================================ */
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("ffmpeg-static");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const outDir = path.resolve(opt("out", "../assets/film-van"));
const fps = Number(opt("fps", 24));
const quality = Number(opt("quality", 4)); // ffmpeg -q:v, 2=best 31=worst
const width = Number(opt("width", 1920));
const height = Number(opt("height", 1080));
const clips = args.filter((a) => !a.startsWith("--"));

if (!clips.length) {
  console.error("No input clips. Usage: node extract-frames.js [--out DIR] [--fps N] clip1.mp4 ...");
  process.exit(1);
}

const staging = path.join(__dirname, "out", "_frames");
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

/* Scale to cover, then centre-crop — matches the canvas draw() in
   js/scroll-film.js so nothing shifts between source and site. */
const vf =
  `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase,` +
  `crop=${width}:${height}`;

let n = 0;
clips.forEach((clip, i) => {
  if (!fs.existsSync(clip)) throw new Error("No such clip: " + clip);
  const part = path.join(staging, `c${i}_%05d.jpg`);
  console.error(`extracting ${path.basename(clip)} ...`);
  execFileSync(ffmpeg, ["-v", "error", "-i", clip, "-vf", vf, "-q:v", String(quality), part]);
});

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (/^frame_\d{4}\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));
}

const files = fs.readdirSync(staging).filter((f) => f.endsWith(".jpg")).sort();
for (const f of files) {
  n += 1;
  fs.renameSync(
    path.join(staging, f),
    path.join(outDir, `frame_${String(n).padStart(4, "0")}.jpg`)
  );
}
fs.rmSync(staging, { recursive: true, force: true });

const bytes = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith(".jpg"))
  .reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0);

console.log(`\n${n} frames -> ${outDir}`);
console.log(`total ${(bytes / 1048576).toFixed(1)} MB  (avg ${Math.round(bytes / n / 1024)} KB)`);
/* index.html resolves data-dir relative to the page, so quote the
   path from the repo root, not just the folder name. */
const webDir = path
  .relative(path.join(__dirname, ".."), outDir)
  .split(path.sep)
  .join("/");
console.log(`\nSet on #film in index.html:`);
console.log(`  data-frames="${n}" data-dir="${webDir}/"`);
if (bytes > 25 * 1048576) {
  console.log(`\nWARNING: over 25 MB. Lower --fps, or raise --quality (higher = smaller).`);
}
