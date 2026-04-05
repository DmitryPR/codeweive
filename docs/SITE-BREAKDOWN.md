# Silk (weavesilk.com) — site & drawing stack breakdown

**Educational use only.** These notes and the companion **codeweive** port in this repo are for **learning the algorithms** behind the public web app and for use with **agents** as documentation—not for passing off a clone as the real Silk product or for uses that conflict with the original authors’ rights. **Original author, CC wording, and disclaimers:** [README.md](../README.md#original-silk-and-attribution).

Source of truth for this note: live assets at `http://weavesilk.com/` (HTML and `js/*`). The app bundle is **CoffeeScript 1.7.1 → JavaScript** in a single file.

## Script load order (from `index.html`)

| Asset | Role |
|-------|------|
| `js/jquery-1.8.1.min.js` | DOM, events, utilities |
| `js/jquery.fullscreen.js` | Fullscreen |
| `js/underscore.min.js` | Helpers (`_.mixin`: touch coords, lerp, localStorage, etc.) |
| `js/knockout-2.2.0.min.js` | UI view model (`data-bind` on `<body>`) |
| `js/d3.v3.min.js` | **Color scales** (`d3.scale`, `d3.interpolateHcl`, `d3.rgb`) — not the main scene graph |
| `js/keymaster.js` | Keyboard (e.g. Space, Z) |
| `js/noise.js` | **Perlin noise** (`noise()`, `PerlinNoise`, Processing-style API) — drives organic motion |
| `js/detect.js` | Device / capability detection |
| **`js/site.js`** | **All generative drawing logic** (~98KB compiled CoffeeScript) |

## Core library: `site.js`

Everything important lives in one IIFE. Named concepts:

### `CanvasUtil`

- Wraps a `<canvas>`: HiDPI sizing (`transformAndResizeForHighDPI`), `resizeToWindow`, `resizeCanvas`.
- `resizeToWindowAndPreserveContents`: `getImageData` / `putImageData` plus a **black `fillRect`** (“Silk-specific blackness hack”) so the buffer stays dark.

### `Silk` — the generative stroke engine

Holds a **polyline** `curve`: array of points `{ px, py, x, y, inputVx, inputVy, life }`. New samples from pointer input call **`addPoint(x, y, vx, vy)`** with `life: startLife` (default **150**).

**Simulation (`step`)** — each frame, for each point:

1. Optional **noise force**: `noise(...)` in 3D (position + time) → angle → acceleration (`noiseForceScale`, `noiseSpaceScale`, `noiseTimeScale`, octaves/fallout).
2. Optional **initial velocity** carry-over from input (`initialVelocityForceScale`, decay).
3. Optional **wind** (`windForceScale`, `windAngle`).
4. **Integration**: `p.x += (p.x - p.px) * friction + accx` (and same for y) — damped inertial motion; then update `px, py`.
5. **Spring between consecutive points**: if distance to previous point exceeds `restingDistance`, apply correction with `rigidity` (verlet-like chain).

**Rendering (`draw` → `drawInstruction` → `drawCurve`)**

1. Snapshot logical positions to `__x__`, `__y__`.
2. For each **draw instruction** (see symmetry below), transform every point: translate to symmetry center, rotate + scale (spiral arm), optional **mirror** (`x = -x`), apply `drawScale` / offsets, then:
3. **`drawCurve`**: `ctx.beginPath()`, `moveTo` first point, loop with **`quadraticCurveTo`** through the chain (control = current point, end = midpoint to next), then **`ctx.stroke()`**.

**Color / compositing (`setColor`)**

- Default **`globalCompositeOperation`: `'lighter'`** (additive glow on black).
- **`globalAlpha`**: `startOpacity * (life / startLife)` (default start opacity **0.09**).
- **`strokeStyle`**: from a **d3 scale** — either time-based or velocity-based domain → `[color, highlightColor]`, **`d3.interpolateHcl`**, clamped.
- Eraser mode uses `'source-over'` when color equals `eraserColor`.

**Symmetry & spiral (`generateDrawInstructions`)**

- **`symNumRotations`**: copies rotated by `2π / symNumRotations`.
- **`symMirror`**: duplicate each arm with `mirror: true` (negate x after rotation).
- **`spiralCopies`** & **`spiralAngle`**: each copy gets extra rotation `spiralAngle * pc` and scale from **`d3.scale.pow().exponent(0.5).domain([0,1]).range([1,0])`** × `brushScale` (smaller toward center of spiral).
- **`rotateAnglesAroundSymmetryAxis`**: noise/wind angles biased by symmetry axis angle `atan2(cx - p.y, cy - p.x)`.

Default-ish physics from `Silk.initialState` (abridged): `friction: 0.975`, `noiseOctaves: 8`, `noiseFallout: 0.65`, `noiseAngleScale: 5π`, `compositeOperation: 'lighter'`, `symMirror: true`, `spiralCopies: 1`, `spiralAngle: 0.75π`, `drawsPerFrame: 5`.

### `PointPreviewSilk` extends `Silk`

Preview cursor: **`arc` + `fill`** per instruction (emphasis highlights spiral / rotation / mirror).

### `Silks`

Orchestrates **multiple canvases**:

- **Main silk canvas** + **buffer** + **sparks canvas** — each gets `CanvasUtil`, `getContext('2d')`.
- Instantiates **`Sparks`**, **`Recorder`**, manages undo/redo snapshots, pointer → `addPoint`, animation loop calling `frame()` on active silks.

### `Sparks`

Separate 2D canvas, `globalCompositeOperation: 'lighter'`, `clearRect` each frame; particles with position, velocity, age, lifespan, **`arc` + `fill`**. **`Silk.sparklePoint`** uses **`d3.rgb(strokeStyle).brighter(2)`** and delegates to `sparks.add`.

### `Tape` / `Recorder`

Tape = time-indexed recording of method calls for replay; Recorder ties into undo/share flows (details in remainder of `site.js`).

## `noise.js`

- **Perlin noise** (3D sampled for `noise()`), Marsaglia PRNG, octave stacking — same family as classic Processing `noise()`.

## What is *not* used for the main ribbons

- **No WebGL** for the silk strokes — it is **Canvas 2D**.
- **D3** is not drawing SVG paths for the main effect; it is scales and color math.

## Rebuild checklist (minimal fidelity)

1. Black full-screen canvas, HiDPI resize like `CanvasUtil`.
2. Implement `noise()` (or drop-in Perlin) compatible with the `step()` call signature.
3. Port **`Silk`**: point chain, `step`, `generateDrawInstructions`, `drawInstruction`, `drawCurve`, `Silk.initialState` tuning.
4. Optional: second canvas for sparks; Knockout/UI can be replaced with any framework.

## Local port (this repo — **codeweive**)

- **Run:** from repo root, `npm install` then `npm run dev` (Vite, default port **5174** per `vite.config.ts`). Open the printed localhost URL in a browser.
- **Build:** `npm run build` emits `dist/`; `public/vendor/noise.js` is copied as static assets (same Perlin implementation as the live site).
- **Implementation map:** `index.html` (markup), `src/silk.ts` (physics + symmetry + stroke), `src/canvas-util.ts` (HiDPI), `src/sparks.ts` + overlay canvas in `src/app.ts`, orchestration and **~16 ms `setTimeout` loop** like the original main tick.

## Visual QA vs live Silk and reference art

1. Open [weavesilk.com](http://weavesilk.com) and the local dev app **side by side** at similar window size (HiDPI affects line width).
2. **Defaults:** mirror on, one rotation, no spiral — draw a slow vertical stroke and a wide side loop; you should see bilateral symmetry, additive cyan/blue glow, and wispy diverging filaments from the same noise + spring chain (not a multi-brush hack).
3. **Spiral:** enable “Spiral copies” locally (approximates many spiral arms); compare to the live site’s spiral toggle.
4. **Reference PNG:** use your saved Silk export as a mood reference only — pixel parity is not expected without identical input timing, `noiseOffset`, and resolution; focus on **blend mode**, **symmetry**, and **motion character**.

## Legal / ethics

Original site and art terms apply; this document is for **technical study** of publicly delivered scripts only.
