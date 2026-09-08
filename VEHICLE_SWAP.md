# VEHICLE_SWAP.md — replacing the coupé with a Mureza panel van

Brief for producing a new scroll-film sequence. Measured from the existing
300 frames in `assets/film/`, not guessed. Hand this to a 3D artist, or use it
as the shot spec for any render pipeline.

## 1. What the current sequence actually is

300 JPGs, `frame_0001.jpg` … `frame_0300.jpg`, **1920×1080**, ~210–260 KB each,
**64 MB total**. It is a CGI product-viz render, not photography and not
image-generation output.

The shot, frame by frame:

| Frame | State |
|---|---|
| 001 | Vehicle fully intact, 3/4 front, nose pointing RIGHT |
| 150 | Bonnet raised, front wheels detaching outward, body rotated to rear 3/4 |
| 253 | Pure side profile, bonnet up, engine block exposed in the bay |
| 300 | Fully exploded — wheels pushed out on extended axles, engine lifted clear of the bay, body panels separated, suspension and chassis rails visible |

**The camera never moves.** The room, the ceiling cove ellipse and the floor
light ring are pixel-stable across all 300 frames. The *vehicle* rotates on a
turntable while it disassembles. Reproduce it that way — a locked-off camera
with an animated subject, not a camera orbit.

## 2. The grade (sampled from frames 001 and 300)

Region means, downsampled to 192×108:

| Region | Frame 001 | Frame 300 |
|---|---|---|
| Ceiling | `#665141` | `#665040` |
| Back wall (travertine) | `#907e6f` | `#897768` |
| Right smoked glass | `#251c17` | `#1d1512` |
| Floor | `#55483e` | `#50433a` |
| Centre / vehicle body | `#4b433e` | `#3f3734` |

Luminance: min 0–1, max 228–229, **mean 75–80**. That mean is the thing to hit.
It is a dark, low-key image with a narrow bright range — the highlights never
clip and the shadows never crush to pure black. Overall cast is warm brown.

Never apply this as a CSS filter. It is baked into the images
(`STUDY.md` §8), and the HTML/CSS layer assumes that.

## 3. Lighting and set

- Warm key from an elliptical recessed **ceiling cove** — a bright arc across
  the upper frame, warm white core falling to amber at the edges.
- **Travertine limestone** back wall, left ~60% of frame, lit from above.
- **Smoked bronze glass panels**, right ~40%, with vertical amber LED strips
  and a dim lounge barely readable behind them.
- **Polished concrete floor**, mirror-grade: the vehicle, the wall and the LED
  strips all reflect into it, fading with distance.
- An **elliptical amber light ring** inset in the floor, encircling the
  vehicle. Hot thin amber line with soft bloom, brightest on the left arc,
  occluded by the vehicle on its far side. This ring is a signature element —
  keep it.
- Gentle film grain. No pure black crush.

## 4. Subject: the Mureza panel van

Substituting a van for a low coupé changes the composition. Two things to hold:

- **Silhouette height.** The coupé's roof sits at ~41% of frame height. A panel
  van is far taller and boxier. Either pull the camera back slightly or accept
  a tighter ceiling gap — but the floor ring must stay fully visible, because
  the CSS hotspot and bottom service bar are positioned against it.
- **Footprint.** The coupé spans x 19.7%→87.9%. Keep the van inside roughly the
  same span so the "PARTNERS" outline word still reads behind it and the
  existing UI overlay positions in `css/style.css` remain valid.

Body finish: warm dark bronze-grey metallic, same family as the coupé —
shadows `#2e2721`, mids `#4a4038`, speculars `#8a7f72`→`#cfc4b4`.

**Note on the vehicle itself:** Mureza's current production models are the
Prim8 hatchback and the T1 pickup. The **panel van is an announced future
model** on the same X100 platform — there is no public reference imagery for
it, and `mureza.co.za` is currently serving unrelated spam content. So the van
has to be either (a) supplied by Mureza as CAD/design data, or (b) designed as
a plausible panel-van body on the Prim8 platform. Decide which before anyone
starts modelling.

## 5. Disassembly choreography

The point of the sequence is to show the supply chain — each part that
separates is a tier of supplier. Suggested beats mapped to the existing
5-tier bar in `index.html` (12 / 10 / 10 / 10 / 08, total 50):

| Scroll | Beat |
|---|---|
| 0–15% | Intact. Slow turntable start. |
| 15–35% | Wheels and brakes separate outward on extended axes (Tier 1 — major systems) |
| 35–55% | Body panels, doors, cargo-area panels peel away (Tier 2 — processing) |
| 55–75% | Bonnet lifts, engine/drivetrain rises clear of the bay (Tier 1/3) |
| 75–100% | Chassis rails, suspension, wiring and interior exposed. Full explode holds. |

Parts should move along clean radial vectors and **stop**, not drift — the user
scrubs back and forth, so every frame is a poster.

## 6. Output contract

The site now reads the sequence from `#film` in `index.html`, so a new
sequence is a drop-in with no JS edit:

```html
<canvas class="film" id="film" aria-hidden="true"
        data-frames="300" data-dir="assets/film/"
        data-prefix="frame_" data-ext=".jpg"></canvas>
```

Requirements:
- 1920×1080, JPEG, zero-padded to 4 digits, 1-based.
- Frame count can be anything — set `data-frames` to match.
- **Every frame must be the same resolution and the camera must not move.**
- Update `data-dir` to a new folder (e.g. `assets/film-van/`) rather than
  overwriting, so the coupé sequence stays available for comparison.

## 7. Weight — read this before committing to 300 frames

64 MB of JPEGs is the single biggest problem with the current approach. This is
a supplier portal aimed at African markets where mobile data is expensive and
connections are often slow. The current loader also requests all 300 frames at
once, 60 ms after load.

Options, cheapest first:
- Cut to 120–150 frames. The scrub still reads as smooth and it roughly halves
  the payload.
- Drop to 1440×810 and re-encode at quality ~72. Typically 50–60% smaller with
  no visible loss at this grade.
- Serve WebP or AVIF with a JPEG fallback. Often 40% smaller again.
- Load progressively — a sparse set of keyframes first, then fill in.
- Or abandon the frame sequence entirely; see below.
