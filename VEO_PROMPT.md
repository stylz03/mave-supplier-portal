# VEO_PROMPT.md — generating the Villager disassembly video

Everything needed to produce the scroll-film in Google Veo / Flow and get the
frames back into the site.

## Input images

In `tools/out/deliver/`, all 1920×1080 and grade-matched to the existing film
(mean luma 76):

| File | Use |
|---|---|
| `01_start_intact.jpg` | **First frame.** Villager intact, front 3/4, nose left. |
| `04_end_exploded_rear.jpg` | **Last frame for the rotating version.** Exploded *and* rotated to rear 3/4 — use this one. |
| `03_end_exploded.jpg` | Last frame for a non-rotating version (same angle as the start). |
| `02_mid_wheels_off.jpg` | Optional midpoint if you split into two clips. |

Use **Frames to Video** in Flow (first frame + last frame). That constrains the
motion far better than a prompt alone, and it is the single biggest lever on
whether this works. Prompt-only image-to-video will drift.

**Use `04_end_exploded_rear.jpg` as the last frame.** Because the start is a
front 3/4 and that end frame is a rear 3/4, the model has to rotate the vehicle
to get from one to the other — which is exactly the turntable motion we want,
and it is far more reliable than asking for rotation in words alone.

## The one distinction that matters

The **camera** must never move. The **vehicle** must rotate.

These are different things and it is easy to collapse them into one
instruction — the first version of this prompt said "never rotates" to stop
camera drift, and the result was a disassembly with no turntable motion at all.
Say "locked-off camera" about the camera, and "rotates on a turntable" about
the van, and never let a negative prompt forbid vehicle rotation.

## The prompt

```
Static locked-off camera on a tripod. THE CAMERA NEVER MOVES — no pan, no
tilt, no zoom, no dolly, no push-in, no crane, no handheld drift, no
parallax. The room, the walls, the ceiling light and the floor stay in
exactly the same place in frame for the entire shot.

The motion in this shot comes entirely from the vehicle, not the camera.

A silver-bronze Mureza Villager van stands on a glowing amber light ring in
a dark warm luxury showroom, seen from a front three-quarter angle with its
nose to the left. The van sits on a slowly revolving turntable. Across the
shot it rotates smoothly and continuously on the spot — about 150 degrees,
one steady unbroken movement — turning away from us so its flank sweeps past
and its rear three-quarter comes into view. The rotation is slow, even and
mechanical, like a motor show display stand. It never speeds up, never stops
and restarts, never reverses.

As it turns, the van simultaneously performs a precise mechanical
exploded-view disassembly. The four road wheels glide outward from their
hubs and hover in mid-air, revealing brake discs, calipers and hub carriers.
The front bumper and grille float forward. The side doors and body panels
separate outward and hang clear of the shell. The bonnet lifts away. The
engine and gearbox rise out of the bay and hang above it. The roof panel
lifts and floats above the cabin. The bare ladder chassis, suspension arms
and springs are left exposed in the centre. As the van comes round we see
the rear doors, rear window and tail lights.

Every detached component keeps rotating with the vehicle, holding its
position in the exploding assembly as the whole arrangement turns together,
as if the van and all its floating parts share one turntable. Parts drift
outward slowly along clean radial lines and settle, suspended and
motionless relative to the vehicle. Precise, weightless, controlled — an
engineering assembly diagram turning in zero gravity.

Nothing falls to the floor. Nothing tumbles or spins on its own axis.
Nothing bounces. The van does not drive, roll or tilt — it only revolves.

The showroom, travertine wall, smoked bronze glass, ceiling cove light and
amber floor ring stay exactly as they are for the whole shot. Warm low-key
cinematic lighting, dark bronze colour grade, polished concrete floor with
soft reflections, subtle film grain. Photorealistic automotive product
visualisation.
```

## Negative prompt

Note what is **not** here: any mention of rotation. The previous version
listed "vehicle rotating" as a negative, which is what killed the turntable.

```
camera movement, camera pan, camera zoom, dolly, crane shot, orbiting
camera, handheld shake, parallax, shifting framing, vehicle driving,
vehicle rolling forward, wheels spinning on their axles, parts falling to
the floor, parts tumbling, explosion, fire, smoke, sparks, debris, people,
hands, text, captions, watermark, arrows, dimension lines, motion blur,
lens flare, changing background, changing lighting, cuts, scene changes
```

## Settings

- **16:9**, **1080p**, highest quality available.
- **8 seconds** at 24 fps gives ~192 frames — already an ideal length for the
  scroll film. You do not need a long video.
- No audio.
- Generate 3–4 takes and pick the one where the camera stays most locked.
  Camera drift is the usual failure; everything else is recoverable.

## RECOMMENDED: two clips, one job each

A single 8s clip asked to rotate 150° *and* fully disassemble leaves the
middle unconstrained, and Veo fills the gap by inventing. The observed
failures were an engine appearing inside the rear cargo bay as the barn doors
opened, and the body drifting off-design into a generic MPV around the
midpoint before recovering.

Splitting fixes both, and needs no new keyframes.

### Clip A — rotation only

`01_start_intact.jpg` → `05_mid_rear_intact.jpg`

```
Static locked-off camera on a tripod. THE CAMERA NEVER MOVES — no pan, tilt,
zoom, dolly, crane, handheld drift or parallax. The room, walls, ceiling
light and floor stay in exactly the same place in frame throughout.

A silver-bronze Mureza Villager van stands on a glowing amber light ring in
a dark warm luxury showroom, seen from a front three-quarter angle, nose to
the left. It sits on a slowly revolving turntable and rotates smoothly and
continuously on the spot through about 150 degrees, in one steady unbroken
movement, until we see it from a rear three-quarter angle. The rotation is
slow, even and mechanical, like a motor show display stand. It never speeds
up, never stops and restarts, never reverses.

THE VAN STAYS COMPLETELY INTACT AND FULLY ASSEMBLED FOR THIS ENTIRE SHOT.
Nothing comes apart. No panel separates. No wheel detaches. No door opens.
The bonnet stays shut, the rear doors stay shut, the roof stays on. It is
simply a whole, undamaged van turning on a turntable.

It keeps its exact identity throughout: the same boxy proportions, the same
tall roofline, the same window line, the same silver-bronze paint, the same
four silver multi-spoke alloy wheels, the same grille and badge.

Warm low-key cinematic lighting, dark bronze colour grade, polished concrete
floor with soft reflections, subtle film grain. Photorealistic automotive
product visualisation.
```

### Clip B — disassembly only

`05_mid_rear_intact.jpg` → `04_end_exploded_rear.jpg`

```
Static locked-off camera on a tripod. THE CAMERA NEVER MOVES. The room,
walls, ceiling light and floor stay in exactly the same place throughout.

A silver-bronze Mureza Villager van stands on a glowing amber light ring in
a dark warm luxury showroom, seen from a rear three-quarter angle.

THE VAN DOES NOT ROTATE, MOVE OR TURN IN THIS SHOT. It stays at exactly this
angle, in exactly this spot, for the whole clip. The only motion is its
parts separating.

It performs a slow, precise, mechanical exploded-view disassembly. The four
road wheels glide outward from their hubs and hover in mid-air, revealing
the brake disc and caliper on each hub carrier. The two rear barn doors
swing out and float back. The sliding side door and the front door float
outward from the flank. The rear bumper floats back. The roof panel lifts
and hovers above the cabin. At the far end the bonnet lifts and floats
forward.

THE ENGINE IS AT THE FRONT OF THE VAN, UNDER THE BONNET. This van is
front-engined. As the bonnet lifts, the engine and gearbox rise out of the
engine bay AT THE FRONT and hang in the air above the front of the vehicle.
There is NO engine in the cargo area. NO engine behind the rear doors. NO
engine at the back of the van. The rear cargo bay is empty — just the bare
floor, walls and seats.

Left at the centre is the bare body shell and the complete ladder chassis
with suspension arms, springs and axles, continuous and unbroken.

EXACTLY FOUR wheels appear in the shot, all identical. No extra wheels, no
loose brake discs or hubs scattered on the floor or in the air. Every panel
stays a complete, whole part with clean finished edges — nothing torn, cut
off or half-missing.

EVERY WHEEL STAYS UPRIGHT AND VERTICAL AT ALL TIMES, standing on its
tread as if still rolling, at its original height above the floor. A
wheel must NEVER tip over, NEVER lie flat on its side, NEVER fall to the
ground, NEVER flatten or melt into the floor, and NEVER turn into a flat
dark shape or a puddle. Each wheel keeps its full round three-dimensional
form and its visible multi-spoke alloy face for the entire shot.

Parts drift outward slowly along clean radial lines, then settle and hold,
suspended and motionless. Nothing falls to the floor. Nothing tumbles.

The van keeps its exact identity throughout — same proportions, same
roofline, same paint, same design.

Warm low-key cinematic lighting, dark bronze colour grade, polished concrete
floor with soft reflections, subtle film grain. Photorealistic automotive
product visualisation.
```

Use the same negative prompt for both, plus for Clip B add:
`engine in the rear, engine in the cargo area, rear-mounted engine,
wheels lying flat, wheels on their side, wheels falling over, flattened
wheels, wheels melting into the floor, extra wheels, five wheels`

### Known failure to watch for in Clip B

In the first pass, frames ~185–225 (of 240) had all four wheels tip over
and lie flat on the floor as dark smears before standing back up by 230 —
which reads as stray extra wheels on screen. The wheel paragraph and the
negatives above target exactly that. It cannot be trimmed out after the
fact: cutting the bad range joins two frames that differ by MAD ~21 when
the normal frame-to-frame delta is ~1-2, so the join reads as a glitch.
Check the middle third of any new Clip B before extracting.

Then extract both together, in order:

```bash
node extract-frames.js --out ../assets/film-van --fps 24 clipA.mp4 clipB.mp4
```

That gives ~384 frames. If the payload is too heavy, drop to `--fps 15`
for ~240 frames.

## If you split it into multiple clips

Each clip's last frame becomes the next clip's first frame, so the seam is
invisible. Swap the middle paragraph of the prompt for one beat at a time:

1. **Wheels** — `01_start_intact.jpg` → `02_mid_wheels_off.jpg`
   *"The four road wheels glide straight outward from their hubs and hover in
   mid-air, revealing brake discs, calipers and hub carriers. Nothing else on
   the van moves."*
2. **Body** — `02_mid_wheels_off.jpg` → `03_end_exploded.jpg`
   *"The bumper, doors, side panels, bonnet and roof separate outward and hang
   clear of the shell. The engine and gearbox rise out of the bay. The bare
   chassis is left exposed."*

Keep the camera-lock paragraph and the negative prompt identical every time.

## Getting the frames back into the site

Download the clip(s) as MP4, then from `tools/`:

```bash
node extract-frames.js --out ../assets/film-van --fps 24 clip1.mp4 clip2.mp4
```

That scales and centre-crops to 1920×1080 using the same geometry as the
canvas `draw()` in `js/scroll-film.js`, numbers everything continuously, and
prints the frame count.

Then set that count on `#film` in `index.html`:

```html
<canvas class="film" id="film" aria-hidden="true"
        data-frames="192" data-dir="assets/film-van/"
        data-prefix="frame_" data-ext=".jpg"></canvas>
```

Nothing else needs changing — the JS reads the sequence from those attributes.

### Grade check

Veo will not exactly match the showroom grade. After extracting, check a few
frames and normalise if they have drifted:

```bash
node grade.js --check ../assets/film-van/frame_0001.jpg
node grade.js --out ../assets/film-van ../assets/film-van/frame_*.jpg
```

Target mean luma is **76**.

### Watch the payload

The current coupé sequence is 64 MB, which is punishing on mobile data. At
1920×1080 and quality 4, ~192 frames lands near 40 MB. To get under ~15 MB:

```bash
node extract-frames.js --out ../assets/film-van --fps 18 --width 1440 --height 810 --quality 6 clip.mp4
```

`extract-frames.js` prints the total and warns past 25 MB.

## Known risks

- **Camera drift** is the main failure mode. If the camera moves, the fixed
  UI overlay in `index.html` will no longer line up with the vehicle and the
  whole shot reads as broken. Reject those takes.
- **Part identity** may wobble — a wheel that becomes a slightly different
  wheel mid-flight. Less critical, since users scrub fast.
- **The badge.** "VILLAGER" on the bumper may garble as it moves. If it does,
  it is small enough to accept or patch later.
