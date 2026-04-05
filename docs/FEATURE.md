# Feature directions — codeweive

This file mixes two kinds of content:

1. **Shipped in the HUD** — working behavior you can try today (Auto-draw, Heartbeat), with pointers into the code.
2. **Exploratory directions** — ideas that are **not** commitments; they assume the **canvas + `Silk` physics** core stays the reference implementation.

When picking up a thread, cross-check [docs/PERFORMANCE.md](PERFORMANCE.md) for cost traps (especially spirals + high rotation counts) and keep attribution clear in any public demo that evokes the original Silk experience.

---

## Auto-draw (autopilot) — shipped

**What it does:** When **Auto-draw** is checked, the app feeds **synthetic `(x, y)`** each tick into the same **`addPoint` / `frame`** path as the pointer. One stroke stays open so ribbons accumulate like manual drawing.

**HUD:** Checkbox **Auto-draw**, plus **Auto path** (enabled only while Auto-draw is on):

| Preset      | Behavior (short)                                              |
| ----------- | ------------------------------------------------------------- |
| **Lissajous** | Wobbly figure-eight / multi-loop path (default).            |
| **Orbit**   | Near-circular orbit around the center.                       |
| **Drift**   | Slow wandering with layered low-frequency sines.             |
| **Pulse**   | Radius “breathes” while the angle advances (in–out feel).   |

**Interaction details:**

- **Manual drawing wins:** While the pointer is down on the canvas, Auto-draw does not move the synthetic cursor (`userPointerHeld` in `src/app.ts`).
- **Live parameters:** Mirror, rotations slider, spiral, and color-bubble palette are pushed into the **active** auto-draw stroke every frame via `syncAutoDrawStrokeWithHud()` so you can retune symmetry and colors without stopping Auto-draw.
- **Code:** `stepAutoDrawInput()`, `syncAutoDrawStrokeWithHud()`, preset handling in `src/app.ts`; `#auto-draw`, `#auto-draw-preset` in `index.html`.

**Not implemented yet (still fair game for §3 below):** noise-walk, attraction to symmetry axes, scheduled **parameter ramps** over time, multiple simultaneous autopilots.

---

## Heartbeat — shipped

**What it does:** When **Heartbeat** is checked, the **whole silk + sparks stack** gets a slow **lub–dub** envelope: combined **CSS `scale`** on `#silk-stage` and **`brightness` / `contrast`** filters on both canvases. It is a **view-layer** pulse, not a modulation of `Silk.step()` physics.

**Code:** `applyHeartbeatVisual()`, `heartbeatStrength()` in `src/app.ts`.

**Not implemented yet:** BPM / depth sliders, tap tempo, or multiplying noise gain / spark rate / spring terms inside `Silk` (see §4 below).

---

## 1. Live, shared drawing *(exploratory)*

**Idea:** Turn the canvas into a **multiplayer or broadcast** surface: other people’s strokes appear in (near) real time, or a single “performance” stream is watched live.

**Moves:** Sync **stroke events** (pointer samples + symmetry settings + palette) over **WebSockets** or **WebRTC data channels** instead of shipping pixels every frame. Reconcile clocks with simple timestamps so remote curves replay through the same `Silk` integrator. Optional: **presence** (cursors, names) layered above the sparks canvas.

**Why here:** The simulation is already deterministic given inputs; you mainly need a thin protocol and conflict rules (who owns clear / global settings).

**Status:** Not started.

---

## 2. Moving, expanding world (camera & growth) *(exploratory)*

**Idea:** Break the fixed fullscreen frame: the **drawing plane moves or grows**—pan/zoom, follow the stroke, or a **slow auto-scroll** so long performances become landscapes instead of clutter.

**Moves:** Treat the silk buffer as a **logical tile or large offscreen** with a **view transform** (scale + translation). Expire or downsample old regions for performance. Export could stitch tiles or record a **path of the camera** for video-style output.

**Why here:** Today everything is centered and letterboxed; decoupling “world space” from “view” is a natural next architectural step.

**Status:** Not started.

---

## 3. Auto mode — broader vision *(exploratory)*

The **Auto-draw** section above is the first slice of this idea. Remaining directions:

- **Noise-walk** or **force injection** instead of only parametric paths.
- **Attraction** to symmetry axes or focal points.
- **Parameter ramps:** automate slow changes to rotations, spiral, or palette over time (could reuse the same HUD sync hook with scripted targets).

**Why here:** No new renderer required—only schedulers and policies that respect the existing stroke lifecycle.

---

## 4. Heartbeat — physics-level pulse *(exploratory)*

The **Heartbeat** section above covers the current **post-process** pulse. Deeper integration could:

- Multiply selected scalars in **`Silk.step`** / **`setColor`** by a shared `envelope(t)`.
- Modulate **spark rate** or **noise gain** with the same envelope.
- Expose **BPM** and **depth** in the HUD; optional **tap tempo** or external clock.

**Why here:** The stack already runs on a timer-driven loop; a global modulation channel is cheap to prototype and reads well with additive glow.

---

## 5. Ambient sound grown from the image *(exploratory)*

**Idea:** **Procedural audio** that listens to the **current canvas** (or per-frame stats): brightness, symmetry energy, dominant hue → drives **drones, gentle arpeggios, or filtered noise** in the Web Audio API—no precomposed tracks.

**Moves:** Downsample the composite to a small grid or read back **histograms** on a throttled interval; map aggregates to **oscillator frequencies**, filter cutoffs, or granular playback of a tiny noise buffer. Keep levels conservative and **user-mutable** (mute, seed, “intensity”).

**Why here:** Silk is already visual-music-adjacent; this repo is a clean place to experiment with **image→audio** mapping without claiming parity with the original’s licensed soundtrack.

**Status:** Not started.
