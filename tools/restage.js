/* ============================================================
   Stage 1 of the van pipeline: put the Mureza Villager into the
   showroom from assets/film/frame_0001.jpg, at that film's grade.

   The output of this becomes the first keyframe of the new
   scroll-film; every disassembly state is then edited FROM it, so
   the van stays the same van across the sequence.

     node restage.js                 # generate, save to out/
     node restage.js --n 3           # 3 variations to pick from
   ============================================================ */
"use strict";

const path = require("path");
const { upload, run, download } = require("./kie");

const MODEL = "gpt-image-2-image-to-image";

const PROMPT = `Place this exact silver Mureza Villager van (first image) into the dark warm luxury automotive showroom of the second image, matching that image's lighting and colour grade precisely.

KEEP THE VAN EXACTLY AS IT IS: same boxy panel-van proportions and tall roofline, same 3/4 front view with the nose pointing to the LEFT, same front grille and round badge, same "VILLAGER" lettering on the front bumper, same side windows, same multi-spoke alloy wheels, same door handles and mirrors. Do not restyle, lower, stretch or sportify the vehicle. It is a commercial passenger van, not a sports car.

ENVIRONMENT: polished dark concrete floor with mirror-like reflections of the van and the walls; pale travertine limestone wall behind and to the left; smoked bronze glass panels on the right with thin vertical amber LED strips; a large elliptical recessed cove in the ceiling casting a warm arc of light above the vehicle; an elliptical amber light ring inset into the floor encircling the van, hot thin amber line with soft bloom, its far side hidden behind the vehicle.

GRADE: low-key, warm, cinematic. Deep warm-brown shadows (#1b140e to #261c13), travertine highlights near #cbbda9, amber accents near #cf8f45. The van's silver paint reads as warm dark bronze-grey under this light, with long soft speculars along the roofline and shoulder line, and a warm amber rim light kissing the rocker panel and wheel arches from the floor ring. Mean image luminance about 78 of 255 — dark and moody, no clipped highlights, no crushed blacks. Subtle film grain.

Photorealistic automotive product render. No text overlays, no people, no watermark.`;

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--n");
  const n = i === -1 ? 1 : Number(args[i + 1]) || 1;

  console.error("uploading references ...");
  const vanUrl = await upload(
    path.join(__dirname, "..", "reference", "van-source.jpg"),
    "images/mave/src"
  );
  const styleUrl = await upload(
    path.join(__dirname, "..", "assets", "film", "frame_0001.jpg"),
    "images/mave/src"
  );

  for (let k = 1; k <= n; k++) {
    console.error(`\ngenerating ${k}/${n} ...`);
    const urls = await run(MODEL, {
      prompt: PROMPT,
      input_urls: [vanUrl, styleUrl],
      aspect_ratio: "16:9",
      resolution: "2K",
    });
    for (const [j, u] of urls.entries()) {
      const dest = path.join(__dirname, "out", `restage_${k}_${j + 1}.png`);
      await download(u, dest);
      console.log(dest);
    }
  }
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
