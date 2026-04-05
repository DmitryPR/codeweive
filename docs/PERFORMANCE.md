# Performance and limitations

**Educational context.** This file describes **scalability and practical limits** of the local port ([`src/silk.ts`](../src/silk.ts), [`src/app.ts`](../src/app.ts)) so learners and agents know where the design trades fidelity for simplicity. It is not a formal benchmark report.

For the mathematical model, see [ALGORITHM.md](ALGORITHM.md). For the live site’s architecture, see [SITE-BREAKDOWN.md](SITE-BREAKDOWN.md).

---

## 1. Execution model

- **Single main thread.** All physics, path building, and rasterization run on the **browser UI thread**. Long frames block input and scrolling (here the page is mostly full-screen canvas, so the main symptom is **jank** or **low FPS**).
- **No Web Workers / WASM / GPU compute** for the curve update. Every `noise()` sample and spring update is plain JavaScript.
- **Timer-driven loop** (`setTimeout` with a ~16 ms target), not `requestAnimationFrame`. Background tabs may **throttle timers**, slowing simulation unevenly compared to the foreground. The original site uses a similar timeout-based tick.

---

## 2. Cost per animation frame (order of growth)

Let:

- \(S\) = number of **active** `Silk` strokes still animating (each finished gesture remains until its points expire).
- \(N\) = points in one stroke’s `curve` (bounded by how long the user dragged × how fast `addPoint` runs; order **hundreds** is easy).
- \(I\) = length of `drawInstructions` ≈ `symNumRotations` × `spiralCopies` × (`symMirror` ? 2 : 1).  
  Example: 6 rotations, 30 spirals, mirror → \(6 × 30 × 2 = 360\) instructions per draw pass.
- \(K =\) `drawsPerFrame` (default **5**).

**Per display tick, per stroke:**

1. **`frame()`** runs \(K\) times: `step(true)`.
2. Each **`step`**:  
   - Physics: **O(\(N\))** — one pass over the curve (noise, springs, integration).  
   - Noise: **8 octaves** per point per substep (default `noiseOctaves`) — constant factor is **large**.  
   - **`draw()`** after each substep: **O(\(I · N\))** — for each instruction, transform every vertex, then stroke the polyline.

**Combined per stroke per frame (roughly):**  
**O(\(K · (N + I · N)\)) = O(\(K · I · N\))** when \(I \gg 1\).

**All strokes:** **O(\(S · K · I · N\))** per tick.

So **spiral + high rotations + many overlapping strokes** scales **multiplicatively**, not additively.

---

## 3. Canvas 2D rasterization

- Each instruction ends in **`stroke()`** on a **wide** path (quadratic segments). With `globalCompositeOperation: 'lighter'`, the GPU/backing implementation often does **read-modify-write** on many pixels per segment. **Additive blending is fill-rate heavy** on large displays.
- **HiDPI** (`devicePixelRatio` > 1) increases backing-store resolution; the same logical stroke covers **more physical pixels**, so compositing cost rises roughly with **pixel count**.
- **Two full canvases** (silk + sparks): sparks clears and redraws particles every frame (another pass over a full-size buffer).

There is **no** instanced mesh or retained GPU path; the browser **re-rasterizes** vector strokes every substep.

---

## 4. Memory and GC

- Each curve point is an **object** in an array. **`curve.shift()`** on the front (dead points) is **O(\(N\))** per shift in typical JS engines because elements move. Many small steps mean many allocations and shifts over a long session.
- **`structuredClone`** / spread used for settings is negligible compared to per-frame work but shows the stack is not tuned for zero-allocation hot paths.
- **No object pooling** for points or paths.

---

## 5. Compared to the original site (qualitative)

The original bundles **Knockout, jQuery, undo snapshots, multiple canvases, recorder**, etc. This port **drops undo/buffer swapping** and most UI, but the **core per-stroke cost** (many substeps × many symmetry instances × 2D strokes) is the same family of work. The original can feel smooth because **one** dominant stroke is common; this port allows **many** concurrent strokes until each expires, which can **amplify** \(S\).

---

## 6. Known practical limits

| Scenario | Risk |
|----------|------|
| Long drag at high pointer rate | Large \(N\); more physics and longer paths per substep. |
| Spiral on + many rotations | Huge \(I\); each of \(K\) substeps redraws all instances. |
| Many strokes without clearing | Large \(S\); linear cost in concurrent silks. |
| 4K / high `devicePixelRatio` | More pixels per `stroke()`; thermal throttling on laptops. |
| Background tab | Timer throttling; motion and input feel out of sync. |
| **Ambient sound** enabled | Periodic **`getImageData`** (small center crop ~every 14 ticks; **full backing store** ~every 20 ticks for color + plate scan). Strided JS loops over pixels; cost rises with **HiDPI** resolution. |

---

## 7. Ambient sound readback

When **Ambient sound** is on, [`src/app.ts`](../src/app.ts) reads the silk canvas from the CPU:

- **Luma** — small **center** region (up to 48×48 in **backing-store** pixels), ~every **14** timer ticks.
- **Color + plate coupling** — **full** `getImageData(0, 0, width, height)` ~every **20** ticks; [`color-music`](../src/color-music.ts) and [`plate-coupling`](../src/plate-coupling.ts) each walk a **strided** grid (separate passes over the same buffer).

Mitigations if this shows up in profiling: increase tick intervals, shrink the full-canvas pass to a **downscaled copy** via draw-to-temp-canvas, or move analysis to a **Worker** (transfer `ImageData`).

---

## 8. Mitigations (not implemented here)

Ideas for a **production** or **performance** fork (listed for learning only):

- Reduce **`drawsPerFrame`** or **`spiralCopies`** / cap **`symNumRotations`** when FPS drops.
- **Decimate** `addPoint` (max points per frame or minimum distance between samples).
- **Draw once per display frame** but advance physics \(K\) times without intermediate `draw()` (changes look; needs tuning).
- Move **noise + springs** to a **Worker**; transfer or simplify state each frame.
- **WebGL/WebGPU**: upload polyline as geometry, symmetry in a vertex shader, additive blending in one pass (large rewrite).
- Replace **`shift()`** with a **ring buffer** or head index to avoid O(\(N\)) pops.

---

## 9. Summary

The port is **faithful to an algorithm that is inherently expensive**: **many** semi-transparent vector strokes per frame with **additive** blending and **optional massive instancing**. It is appropriate for **learning and desktop demos**; it is **not** tuned for worst-case mobile or “unlimited” spiral arms without degradation.
