# STUDY.md — Forensic notes on reference/reference.png (1672×941, 16:9)

All positions are given as % of page width (W) / height (H), measured from the top-left.
Source of truth: reference/reference.png. Crops in reference/crops/.

## 1. Concept
"VANTA MOTORWORKS — Private Automotive Atelier." One full-viewport cinematic hero:
a dark bronze-gray grand touring coupé in a warm luxury showroom, giant outline
word "PRECISION" behind the car, thin glassy UI layered on top. No other sections visible.

## 2. Global frame
- Thin hairline rounded-rectangle FRAME inset around the viewport:
  left/right edges at ~1.7% W (x≈28 / x≈1644), top at ~3.2% H (y≈30), bottom at ~96.8% H (y≈911).
  Corner radius ≈ 24px (≈1.4% W). Stroke ~1px, color rgba(235,228,215,0.55) — brighter
  where it crosses lit areas (bottom-left is crisp white over the lit floor).
- The page has NO scroll in the mockup: one 16:9 screen.

## 3. Color palette (sampled visually from crops)
- Base near-black warm brown: #1b140e → #261c13
- Travertine wall light: #cbbda9; mid: #b3a390; shadowed: #8d7f6d
- Ceiling shadow plane: #4a3d31
- Cove light core: #f7e7cf; warm glow: #e8c9a0
- Gold/copper accent (text + details): #cf8f45 (range #c9863f–#d99e58)
- Amber floor-ring light: #e8a55c (hot core #ffd9a8)
- Off-white text: #f2ede6 / dimmer body text: #c7bcae / mid gray-warm: #b8afa4
- Car paint: warm dark bronze-gray, shadows #2e2721, mid #4a4038, speculars #8a7f72 → #cfc4b4
- Smoked glass panels: #17110c with amber LED strips #d98e4a

## 4. The scene / background plate (to generate)
- Warm luxury showroom. LEFT ~62%: travertine limestone walls + ceiling; a huge recessed
  elliptical ceiling cove with a bright warm light arc sweeping from x≈21% to x≈70%,
  dipping to y≈12-14% at its center; glow bleeds down the wall.
- Far left edge: brighter vertical travertine pillar catching light (x 0–7%).
- RIGHT ~38%: floor-to-ceiling smoked-glass / dark bronze panels. One bright vertical amber
  LED strip at x≈71.5% running y 12%→60%; fainter warm strips further right; behind the glass
  a dim lounge (table, bowl, chair silhouettes) reads at x 85–95%, y 45–60%.
- FLOOR: polished reflective concrete/terrazzo, warm gray-brown; mirror-like reflections of
  car, walls and LED strips. A huge ELLIPTICAL AMBER LIGHT RING inset in the floor around
  the car: center ≈ (48.7% W, 73.3% H), rx ≈ 42% W, ry ≈ 10% H; hot thin amber line with
  soft glow, brightest on the left arc; the car occludes its far side.
- Light direction: main warm key from upper-left cove; secondary amber rims from right panels.
- Mood: quiet, warm, expensive; deep shadows, no pure black crush, gentle film grain feel.

## 5. Hero car (the subject to generate)
- Dark bronze-gray metallic grand touring coupé (fictional; Maserati-GranTurismo-like mixed
  with Aston DB12 cues). 3/4 front view, nose pointing RIGHT, seen slightly from front-left.
- Span: x 19.7% → 87.9% W; roof apex y≈41.5% H; wheels bottom y≈76.5% H. Center ≈ x 53%.
- Pose details: long bonnet, fastback roofline sweeping into short tail at LEFT of frame;
  front wheel at x≈60%, rear wheel at x≈26%. Both wheels: black multi-spoke (10 thin twin
  spokes), GOLD/BRONZE brake calipers visible behind spokes. Flush door handle. A slim
  chrome-edged side vent/gill on the front fender with 3 dark slats (x≈47-53%, y≈52%).
- Front: sleek slim LED headlights with a bright white lit strip; LARGE oval black grille
  with VERTICAL slats (Maserati-style) at x≈77-84%, y≈57-66%; carbon front splitter low.
- Highlights: long soft speculars along roofline and shoulder line from the cove light;
  amber rim light kisses the rocker panel and wheel arches from the floor ring; crisp
  reflection of the car on the floor below (slightly darker, fades down).
- Windows dark smoked; a faint warm interior hint through the glass.

## 6. Typography (all real HTML text)
Typeface look: thin/light geometric sans (Jost / Poppins Light / Montserrat Light family feel),
generous letter-spacing on ALL caps text. System stack fallback:
"Avenir Next", "Century Gothic", "Futura", "Trebuchet MS", sans-serif.

### 6a. Header (row center-line y ≈ 8.1% H)
- LOGO MARK at x 3.3–8.1% W, y 4.2–12.2% H: two overlapping thin-stroke V/W chevrons
  (white, ~2px strokes), with ONE short gold/copper diagonal stroke inside the left V.
- "VANTA MOTORWORKS" — caps, ~13px @1672 (0.78% W), letter-spacing ~0.25em, #f2ede6,
  baseline y≈7.6% H, starts x≈8.9% W.
- "PRIVATE AUTOMOTIVE ATELIER" — caps, ~9.5px, ls ~0.22em, #b9ac9c, y≈9.6% H.
- NAV (caps, ~12px, ls ~0.2em, #ded8cf), centers: SERVICES x≈36.2%, PERFORMANCE x≈45.9%,
  ATELIER x≈55.3%, JOURNAL x≈63.5%; all on y≈8.1% H line.
- CTA PILL "BOOK INSPECTION ↗": x 84.3–96.5% W, y 5.6–10.6% H; fully rounded; 1px border
  rgba(240,233,220,0.55); DARK translucent glassy fill rgba(18,13,9,0.35); text caps ~12px
  ls 0.18em #f2ede6; arrow ↗ after text.

### 6b. Giant display word
- "PRECISION" — OUTLINE ONLY (transparent fill, ~1.5px stroke rgba(245,240,230,0.85)).
- Spans x 13% → 87% W; cap top y≈21.8% H, baseline y≈37.7% H → cap height ≈ 15.9% H.
- Weight: Light/Thin; wide geometric letterforms; slight extra letter-spacing (~0.06em).
- Sits BEHIND the car (car roof overlaps letters E-C-I-S-I from below) but IN FRONT of the
  background walls. Layer sandwich: bg plate → outline text → car cutout.

### 6c. Left text block
- Thin vertical rule at x≈4.1% W spanning y 41.8–50.2% H; TOP segment (y 41.8–43.6%) gold
  #cf8f45, remainder rgba(120,110,95,0.7).
- "01 / SIGNATURE SERVICE" — caps ~9px, ls 0.22em, #d8cbb8, y≈42.4% H, x≈5.0% W.
- "ENGINEERED CARE." — ~19px (1.14% W), weight 400, #f5f0e8, slight ls 0.04em, y≈46.2% H.
- "For machines that deserve more." — ~12.5px, #c7bcae, y≈50.0% H. Sentence case.

### 6d. Right vertical rail
- Rotated 90° (reads bottom→top): "— VANTA 01 — GRAND TOURING" caps ~10px ls 0.28em
  #d6cec2, centered on x≈96.8% W, spanning y ≈ 37.5–62%.
- Below, HORIZONTAL: "01 / 04" at x≈95.2–97.8% W, y≈65.5–66.5% H; "01" #f2ede6, "/ 04"
  rgba(214,206,194,0.55). ~11px, ls 0.15em.

### 6e. INSPECT hotspot
- Circle center ≈ (64.5% W, 69.9% H), diameter ≈ 2.75% W (~46px): 1px gold ring
  rgba(207,143,69,0.9), very subtle dark translucent fill, tiny white ring-dot (Ø ~9px,
  2px white stroke) at center. A short thin gold tick extends right from the ring edge.
- Label "INSPECT" caps ~9px ls 0.25em #efe9df at x≈66–68.5% W, y≈72.4% H (below-right).

### 6f. Bottom service bar (glassy)
- Rounded rect: x 16.1–83.1% W, y 80.6–88.2% H; radius ~14px; 1px border
  rgba(240,233,220,0.28); fill: dark warm translucent gradient (lighter at right),
  slight blur-glass feel.
- Three items, each = big number + stacked two lines:
  01  DIAGNOSTICS      / 48-POINT ANALYSIS   ← subtitle GOLD #cf8f45
  02  PERFORMANCE      / CALIBRATION & SETUP  ← subtitle #b8afa4
  03  CRAFT            / DETAILING & RESTORATION ← subtitle #b8afa4
- Numbers: ~26px thin, #cfc8bd, at x≈19.4%, 35.9%, 53.2% W. Titles caps ~12px ls 0.15em
  #f2ede6; subtitles caps ~10.5px ls 0.12em. Text blocks start right of each number.
- Vertical 1px hairline separators rgba(255,255,255,0.18) at x≈32.5%, 50.2%, 69.7% W
  spanning the bar's inner height.
- "VIEW SERVICE ↗" gold #cf8f45 caps ~12px ls 0.25em at x≈71.9–80% W, centered vertically.

### 6g. Footer line
- "EXPLORE SERVICES ↓" centered x≈49% W, y≈93.7% H; caps ~11px ls 0.35em #ddd6cb.
- Progress line at y≈96.2% H: faint 1px track x 3.6→19.5% W rgba(235,228,215,0.5);
  a brighter white portion x 3.6→13%; a 3px GOLD segment x 13→16% W (#cf8f45).
  (Reads as slide progress: slide 1 of 4.)

## 7. Layering (page build order, bottom → top)
1. Background plate image (showroom, cove light, LED strips, floor + amber ring, reflections)
2. "PRECISION" outline HTML text
3. Car cutout PNG (with its floor shadow/reflection baked or faded via soft mask)
4. All UI text/elements (header, blocks, rails, bar, hotspot, frame)

## 8. Rules
- Grade baked into images, NO CSS filters.
- Relative units only (vw/vh/%/em); no fixed page px sizes; no horizontal scroll.
- 1920×1080 is only the screenshot size for comparison.
- All text real HTML/CSS. Logo mark = inline SVG (two thin V strokes + gold accent stroke).
