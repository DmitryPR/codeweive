# Feature directions — where codeweive could go

This file is **not a roadmap or commitment**—only **original directions** the project could take while staying an educational, unofficial study of Silk-style generative strokes. Each idea assumes the current **canvas + `Silk` physics** core stays the reference implementation.

---

## 1. Live, shared drawing

**Idea:** Turn the canvas into a **multiplayer or broadcast** surface: other people’s strokes appear in (near) real time, or a single “performance” stream is watched live.

**Moves:** Sync **stroke events** (pointer samples + symmetry settings + palette) over **WebSockets** or **WebRTC data channels** instead of shipping pixels every frame. Reconcile clocks with simple timestamps so remote curves replay through the same `Silk` integrator. Optional: **presence** (cursors, names) layered above the sparks canvas.

**Why here:** The simulation is already deterministic given inputs; you mainly need a thin protocol and conflict rules (who owns clear / global settings).

---

## 2. Moving, expanding world (camera & growth)

**Idea:** Break the fixed fullscreen frame: the **drawing plane moves or grows**—pan/zoom, follow the stroke, or a **slow auto-scroll** so long performances become landscapes instead of clutter.

**Moves:** Treat the silk buffer as a **logical tile or large offscreen** with a **view transform** (scale + translation). Expire or downsample old regions for performance. Export could stitch tiles or record a **path of the camera** for video-style output.

**Why here:** Today everything is centered and letterboxed; decoupling “world space” from “view” is a natural next architectural step.

---

## 3. Auto mode — the machine draws

**Idea:** An **autopilot** that drives the pointer (or injects forces) so the app becomes a **generative installation**: slow loops, Lissajous-like orbits, attraction to symmetry axes, or **noise-walk** through the plane while you only tune parameters.

**Moves:** Feed **synthetic `(x, y, vx, vy)`** into the same `addPoint` / `frame` loop; add presets (“orbit,” “drift,” “pulse toward center”). Optional: schedule **parameter ramps** (rotations, spiral, colors) over time.

**Why here:** No new renderer required—only a scheduler and a policy that respects the existing stroke lifecycle.

---

## 4. Heartbeat — organic tempo in the stroke

**Idea:** Tie the **whole drawing** to a slow **pulse**: line opacity, noise gain, spark rate, or spring tension **breathes** on a 60–90 BPM envelope so the piece feels alive even when the hand is still.

**Moves:** Multiply selected scalars in `step` / `setColor` by a shared `envelope(t)` (sine or asymmetric “lub-dub”). Expose **BPM** and **depth** in the HUD; optional sync to **tap tempo** or external clock.

**Why here:** The stack already runs on a timer-driven loop; a global modulation channel is cheap to prototype and reads well with additive glow.

---

## 5. Ambient sound grown from the image

**Idea:** **Procedural audio** that listens to the **current canvas** (or per-frame stats): brightness, symmetry energy, dominant hue → drives **drones, gentle arpeggios, or filtered noise** in the Web Audio API—no precomposed tracks.

**Moves:** Downsample the composite to a small grid or read back **histograms** on a throttled interval; map aggregates to **oscillator frequencies**, filter cutoffs, or granular playback of a tiny noise buffer. Keep levels conservative and **user-mutable** (mute, seed, “intensity”).

**Why here:** Silk is already visual-music-adjacent; this repo is a clean place to experiment with **image→audio** mapping without claiming parity with the original’s licensed soundtrack.

---

## Using this doc

When picking up one of these threads, cross-check [docs/PERFORMANCE.md](PERFORMANCE.md) for cost traps (especially spirals + high rotation counts) and keep attribution clear in any public demo that still evokes the original Silk experience.
