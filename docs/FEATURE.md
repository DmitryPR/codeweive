# Feature directions — codeweive

This file mixes two kinds of content:

1. **Shipped in the HUD** — working behavior you can try today (Auto-draw, Heartbeat, Ambient sound), with pointers into the code.
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

## Ambient sound — shipped

**What it is:** Optional **procedural** audio (**Web Audio API**, **no samples**): a **water-register** texture meant to feel like a **quiet, rippling surface** — deep **sines**, **filtered noise**, **standing-wave** math, and a **soft delayed phrase** line. A **master low-pass** keeps the mix in a **subdued band** (~0.5–1.1 kHz) so nothing reads as brittle treble. Runs on **static hosting** (e.g. GitHub Pages).

**HUD:** Checkbox **Ambient sound**. Turning it on is a **user gesture** → `AudioContext.resume()` for autoplay policy. Tab **visibility** → `resumeIfNeeded()` so audio can resume when the page returns to the foreground.

### Signal flow (high level)

1. **Vision → numbers** — `getImageData` (throttled) + [`src/color-music.ts`](../src/color-music.ts): **preset mask**, **soft `presetWeights`**, distinct colors, gray-center hint, etc.
2. **Harmony** — Each HUD preset is a **fixed major scale degree** (1…7): semitone steps from tonic `[0,2,4,5,7,9,11]`. **Tonic pitch class** **transposes** when **two or more** colors are active (rounded weighted mean of their “C-key” reference chroma). **One** color only → tonic **0** so solo strokes keep the same **absolute** pitches as before. Weighted **centroid** (fractional semitone) then glides the **flow triad** (½× sub, root, fifth at **C2-class** base). **Melody pool** uses the **transposed** pitch classes; phrase **tempo** still responds to activity and **plate** overlap.
3. **Standing-wave field** — [`src/standing-waves.ts`](../src/standing-waves.ts): rectangular **mode** shapes + weak **hex / Faraday-like** term, driven by centroid, **distinct color count**, **HUD rotations**, **ink** (luma + motion + energy), and **time**. Orbiting **(u, v)** samples feed **breathing** gains, **delay**, and **fluid** dynamics.
4. **Strokes as plate** — [`src/plate-coupling.ts`](../src/plate-coupling.ts): on the same full-canvas pass as color analysis, **strided** ink × field overlap → **`meanF`**, **`rmsF`**, **`coverage`** → detune, noise, phrase bias, low-pass nudges (still dark overall).
5. **Melody + ripple** — [`src/ambient-phrases.ts`](../src/ambient-phrases.ts) phrase book; **lead** sine through **delay / feedback**; second sine a **perfect fifth** above lead (very quiet), same bus.
6. **Drawing feedback** — [`src/ambient-sound.ts`](../src/ambient-sound.ts) exposes **`getDriveState()`** (`flowPhase`, `melodyHz`, `ripple`, `baseFlowHz`). [`src/app.ts`](../src/app.ts) applies a **smoothed Lissajous offset** (a few logical px) to **`addPoint`** while ambient is on; pointer **velocity** stays real so the line **shimmers** without fighting the hand.

**Gray center:** When the **center** reads as the **gray** preset, the **middle flow** layer gets a small **gain swell** only.

**Sampling:** Center **luma** ~every **14** ticks (small crop); **full canvas** ~every **20** ticks for color **and** plate coupling (one `getImageData` shared). Cost scales with backing-store size — see [PERFORMANCE.md](PERFORMANCE.md).

| Module | Role |
|--------|------|
| [`src/color-music.ts`](../src/color-music.ts) | `analyzeSilkImageData`, `presetWeights`, centroid, pool helpers |
| [`src/standing-waves.ts`](../src/standing-waves.ts) | `sampleStandingWaveField`, `sampleStandingWaveVelocity` |
| [`src/plate-coupling.ts`](../src/plate-coupling.ts) | `plateCouplingFromImageData` |
| [`src/ambient-phrases.ts`](../src/ambient-phrases.ts) | Phrase degree patterns |
| [`src/ambient-sound.ts`](../src/ambient-sound.ts) | Graph, modulation, `getDriveState` |
| [`src/app.ts`](../src/app.ts) | `#ambient-sound`, hints, sound dither on stroke |

**Phrase / melody details:** [docs/AMBIENT-MELODIES.md](AMBIENT-MELODIES.md).

### Next steps (ambient)

| Area | Idea |
|------|------|
| **Controls** | HUD **wet/dry**, **master level**, optional **brightness cap** for low-pass; mute fluid or lead independently. |
| **Harmony** | Treat **non-preset** (blended) RGB as **continuous pitch** or **vector in pitch space**, not only nearest swatch + weights. |
| **Plate** | Stronger or **frequency-selective** coupling (e.g. project ink onto a few mode shapes); optional **Worker** for `getImageData` + scan. |
| **Melody** | Third **ripple** voice (e.g. major third), **staggered** phrase echo, or **user-picked** scale / root; **seed** for reproducible sessions. |
| **Drawing ↔ sound** | Toggle **sound-reactive dither** strength; apply `getDriveState` to **auto-draw** path or **noise** in `Silk` (careful with UX). |
| **Tech** | Optional **Tone.js** or **AudioWorklet** for richer routing (still static-hostable); **record** mix to WAV for export. |
| **Docs / QA** | Short **listening** checklist (headphones, plate coverage, rotations); compare CPU with ambient **on vs off** on large canvases. |

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

## 5. Ambient sound — beyond the current ship *(exploratory)*

The **Ambient sound** section above describes what is **implemented** today (standing-wave + plate + phrase + closed loop). This section is for **larger** experiments that would **extend** that design.

**Idea:** Richer **image→audio** maps: **histograms**, **polar energy** around the symmetry center, **optical flow** from frame differencing, or **granular** textures driven by pixel statistics — still without claiming parity with the original site’s **licensed** soundtrack ([Mat Jarvis](http://microscopics.co.uk/) on the live Silk).

**Moves:** See **Next steps (ambient)** in the shipped section for concrete knobs (controls, extra voices, Workers). Bigger leaps: **multi-track** export, **MIDI** side-channel from the same analysis, or **collaborative** sessions where remote strokes feed one shared ambient bus.

**Status:** **Shipped:** preset + weight analysis, luma, full-canvas strided plate coupling, procedural graph, `getDriveState` → stroke dither. **Not started:** histogram-first mapping, MIDI, recording UI.
