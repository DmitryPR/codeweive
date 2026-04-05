# Silk stroke algorithm — mathematics and drawing details

**Educational use only.** This write-up and the companion code exist **solely for learning**: the mathematics and rendering behavior behind generative “silk” strokes, and as a **pedagogical** reference for **coding agents** and students. It is **not** an official product, replacement, or endorsement of the original site. **Attribution, the original author, and licensing context** are in [README.md](../README.md) (“Original Silk and attribution”).

---

This document describes the **generative stroke model** implemented in [`src/silk.ts`](../src/silk.ts), **aligned with** the public [Silk / Weave Silk](http://weavesilk.com) experience (as implemented by **codeweive** — TypeScript + Vite). It is the reference for **why** the visuals look the way they do (filaments, glow, symmetry), not a walkthrough of the original minified bundle. **§4** documents the vendored **Perlin** script ([`public/vendor/noise.js`](../public/vendor/noise.js)); **§5** onward covers the stroke integrator and drawing pipeline.

---

## 1. High-level model

Each user stroke is a **time-evolving open polyline** (the `curve`). Vertices are not fixed to the pointer: they move under **damped inertia**, **Perlin noise forces**, optional **wind**, and **spring constraints** between neighbors. The same polyline is **instanced** several times per simulation substep via **rotation, optional mirror, and per-instance scale** (spiral mode), then stroked on a 2D canvas with **low alpha** and **`lighter` compositing** so overlaps add up to bright “glow.”

There is **one** logical chain of points; “hair” and ribbons come from **physics + many translucent redraws**, not from drawing many parallel offset brushes.

---

## 2. State per curve vertex

Each point \(p\) stores:

| Field | Role |
|--------|------|
| `x`, `y` | Current position in **symmetry plane** coordinates (same space as pointer samples). |
| `px`, `py` | **Previous** position, used as velocity memory for the integrator. |
| `inputVx`, `inputVy` | Pointer **velocity sample** at creation time; decays each substep for “carry” of the stroke direction. |
| `life` | Integer countdown; when it hits 0 the point is removed from the **front** of the queue (trail head dies first). |

New samples append at the **tail** via `addPoint(x, y, vx, vy)` with `life = startLife` (default **150**).

---

## 3. Coordinate spaces

- **Logical canvas space:** After HiDPI setup, drawing uses **CSS-pixel** units on the canvas backing store (context may be scaled by `devicePixelRatio`).
- **Symmetry center** \((c_x, c_y)\) = `symCenterX`, `symCenterY` (typically the screen center in logical pixels).
- **Resize / letterbox:** If the logical size differs from `originalLogicalWidth` / `originalLogicalHeight`, a uniform scale `drawScale = min(W/W_0, H/H_0, 1)` and offsets `offsetX`, `offsetY` center the composition (see constructor in `silk.ts`).

All physics runs in the **unscaled** symmetry plane; **drawInstruction** maps into the scaled, offset screen space used for `stroke()`.

---

## 4. Vendored Perlin noise (`public/vendor/noise.js`)

This file is the same **Processing-style** noise stack the live site loads as `js/noise.js`: it defines **`PerlinNoise`**, the global **`noise(x, y, z, octaves, fallout)`** used by [`src/silk.ts`](../src/silk.ts), plus **`noiseDetail`** / **`noiseSeed`** and **`noiseProfile`** on `window`. Comments in the source point to Ken Perlin’s notes and classic Processing behavior.

### 4.1 Pseudorandomness (`Marsaglia`)

A small **Marsaglia** generator (comment cites a Bielefeld algorithms page) implements `nextInt()` and `nextDouble()` with 32-bit-style mixing. **`PerlinNoise(seed)`** uses either a user seed or **`Marsaglia.createRandomized()`**, which seeds from **`Date`** (minute-granularity and sub-minute parts), so reloads usually get a **new** permutation table unless you fix the seed.

### 4.2 Permutation table

The constructor fills **`perm[0..255]`** with `0..255`, **shuffles** with the PRNG (`j = rnd.nextInt() & 0xFF` swaps), then **duplicates** into **`perm[256..511] = perm[0..255]`** so lookups never need a modulo on the index chain.

### 4.3 Gradient and lattice noise (`noise3d`)

For a sample \((x,y,z)\), integer lattice cell \((X,Y,Z) = (\lfloor x\rfloor \bmod 256, \ldots)\) and fractional parts \((x-X,y-Y,z-Z)\). **Fade curves** use the smoothstep \(f(t) = t^2(3-2t)\) on each fractional coordinate (same family as **improved Perlin**).

Eight corners contribute via **`grad3d(hash, ...)`**: the hash selects one of 16 **linear** forms in \(x,y,z\) (an optimized switch version of the usual Perlin gradient selection; comment cites Riven8192). Results are **trilinearly interpolated** with `lerp`. **`noise2d`** / **`noise1d`** exist on the class but are not used by the global `noise()` in this vendored build.

### 4.4 Octave stack (`window.noise`)

The exported **`noise(x, y, z, octaves, fallout)`** (Silk passes all five arguments) uses a **single** cached **`noiseProfile.generator`** (instantiated as **`new PerlinNoise(0)`** at load in this file). For each octave \(i = 0 \ldots \texttt{octaves}-1\):

- **`effect *= fallout`** each iteration (starts at **1**, so the first octave’s weight is **`fallout`**, not 1 — same as the modified Processing-style loop in the source).
- **`k *= 2`** each octave (frequency doubles).
- Accumulate **`effect * (1 + noise3d(kx, ky, kz)) / 2`**, i.e. each raw Perlin sample in roughly \([-1,1]\) is mapped to \([0,1]\) before weighting.

The return value is a **weighted sum** of those terms; with large **`fallout`** the sum can exceed **1.0** (the file’s docblock warns similarly for Processing).

### 4.5 `noiseDetail` and `noiseSeed`

- **`noiseDetail(octaves, fallout?)`** stores defaults on **`noiseProfile`** for callers that read them (Silk does **not** use this path—it passes octaves/fallout into **`noise()`** directly each call).
- **`noiseSeed(seed)`** assigns **`noiseProfile.seed`** and sets **`noiseProfile.generator = undef`** in the source; in practice the module also **pre-assigns** `generator = new PerlinNoise(0)`, so **re-seeding** only takes effect if client code reconstructs the generator. This port does not call **`noiseSeed`** from `silk.ts`.

### 4.6 How [`src/silk.ts`](../src/silk.ts) uses it

Silk samples **3D** noise at scaled position plus time (see §5.4), then maps the scalar to an **angle** for acceleration. For that pipeline, only the **shape** of \(N = \texttt{noise}(\ldots)\) matters (smooth, multi-frequency); the exact **Marsaglia** seed affects **reproducibility** between full page loads, not the character of the motion.

---

## 5. Simulation timestep (`step`)

One `step` advances the curve by **one** internal tick: increment counters, cull dead head vertices, update every vertex, optionally **draw** once.

### 5.1 Counters

- `time` — incremented every substep; feeds the **third** coordinate of 3D noise.
- `timeColorScaleTime` — incremented every substep; used when `highlightMode === "time"`.
- `frameTime` — incremented once per **outer** `frame()` (used for sparkle cadence).

### 5.2 Remove expired head

While the first point has `life === 0`, **shift** it off the array. The trail shortens from the **start**, so the stroke appears to consume itself from the oldest end.

### 5.3 Symmetry axis angle (optional)

If `rotateAnglesAroundSymmetryAxis` is true:

\[
\theta_{\mathrm{sym}} = \operatorname{atan2}(c_x - y,\; c_y - x)
\]

(Note the argument order matches the source: `atan2(cx - p.y, cy - p.x)`.)

This rotates the **noise** and **wind** directions so forces tend to align with the radial structure around the center.

### 5.4 Perlin noise acceleration

Silk calls **`window.noise(sx, sy, sz, octaves, fallout)`**; the implementation and octave rules are in **§4**. Sample arguments:

\[
\begin{aligned}
s_x &= \texttt{noiseOffset} + x \cdot \texttt{noiseSpaceScale} + 10^6 \\
s_y &= \texttt{noiseOffset} + y \cdot \texttt{noiseSpaceScale} + 10^6 \\
s_z &= \texttt{noiseOffset} + \texttt{noiseTimeScale} \cdot t
\end{aligned}
\]

Let \(N \in \mathbb{R}\) be the returned value (roughly in a bounded range after octaves). Define:

\[
\phi = \texttt{noiseAngleOffset} + \texttt{noiseAngleScale} \cdot N + \theta_{\mathrm{sym}}
\]

(with \(\theta_{\mathrm{sym}} = 0\) if rotation around the symmetry axis is off).

Acceleration contribution:

\[
(a_x,\ a_y)_{\mathrm{noise}} = \texttt{noiseForceScale} \cdot (\cos\phi,\ \sin\phi)
\]

Defaults: `noiseSpaceScale = 0.02`, `noiseTimeScale = 0.005`, `noiseOctaves = 8`, `noiseFallout = 0.65`, `noiseAngleScale = 5\pi`, `noiseForceScale = 1`.

### 5.5 Pointer velocity memory

\[
(a_x,\ a_y)_{\mathrm{input}} = \texttt{initialVelocityForceScale} \cdot (\texttt{inputVx},\ \texttt{inputVy})
\]

If both `inputVx` and `inputVy` are non-zero, they are multiplied by `initialVelocityDecay` (default **0.98**) each substep so the bias fades.

### 5.6 Wind

If `windForceScale > 0`:

\[
\psi = \texttt{windAngle} + \theta_{\mathrm{sym}}
\]
\[
(a_x,\ a_y)_{\mathrm{wind}} = \texttt{windForceScale} \cdot (\cos\psi,\ \sin\psi)
\]

Default `windForceScale = 0` (off).

### 5.7 Damped inertial integration

Total acceleration \((a_x, a_y)\) is the sum of the active terms. Then:

\[
\begin{aligned}
x &\leftarrow x + (x - p_x)\cdot \mu + a_x \\
y &\leftarrow y + (y - p_y)\cdot \mu + a_y \\
p_x &\leftarrow x,\quad p_y \leftarrow y
\end{aligned}
\]

where \(\mu = \texttt{friction}\) (default **0.975**). This is **not** a full Verlet integrator, but \((x-p_x)\) acts like a velocity estimate scaled by friction; adding \(a\) each step gives smooth, momentum-like motion.

Then `life -= 1`.

### 5.8 Neighbor spring (pairwise correction)

For each index \(i \ge 1\), let \(q\) be the previous point \(i-1\). Vector \(\vec{d} = q - p\), distance \(r = \|\vec{d}\|\). If \(r > \texttt{restingDistance} + 0.01\):

\[
k = \frac{\texttt{rigidity}\cdot(\texttt{restingDistance} - r)}{r}
\]
\[
\vec{f} = k \cdot \vec{d}
\]

Then **push** points apart along \(\vec{d}\): subtract \(\vec{f}\) from \(p\) and add \(\vec{f}\) to \(q\) (default `restingDistance = 0`, `rigidity = 0.2`). This keeps the chain from collapsing and lets nearby points **shear** slightly, which reads as fine strands when combined with noise.

---

## 6. Outer frame (`frame`)

Each animation tick:

- `frameTime += 1`
- Repeat **`drawsPerFrame`** times (default **5**): `step(true)`.

So per **display** tick the curve advances **5** substeps and **draws 5** times (unless `drawThisStep` is false). That is why a single gesture builds **dense** additive color: many semi-transparent strokes per ~16 ms.

---

## 7. Draw instructions (symmetry and spiral)

Before drawing, `generateDrawInstructions()` fills an array of **instructions**. Each instruction is:

- `cos`, `sin` — combined rotation angle \(\alpha = \texttt{rotateBy} + \texttt{spiralAngle} \cdot p_c\)
  - `rotateBy = rotationIndex * (2\pi / symNumRotations)`
  - \(p_c = \texttt{spiralIndex} / \texttt{spiralCopies}\) (when `spiralCopies = 1`, \(p_c = 0\))
- `scale` — radial falloff for spirals: a **power scale** with exponent **0.5**, domain \([0,1]\), range \([1,0]\), times `brushScale`
- `original` — true only for the first rotation/spiral arm (used for sparkle sampling)
- `mirror` — if `symMirror`, a **second** instruction duplicates each arm with `mirror: true`

**Mirror** is implemented as negating **x** after rotation (see below), i.e. reflection across the vertical axis through the symmetry center when the base rotation is 0.

---

## 8. Per-instruction geometry (`drawInstruction`)

Let \((x,y)\) be the frozen simulation positions `__x__`, `__y__` (copies of logical positions before any instance transform).

1. Translate to center: \(x' = x - c_x,\ y' = y - c_y\)
2. Rotate and **spiral scale** (same factor on both axes here):

\[
\begin{aligned}
x'' &= (x' \cos\alpha - y' \sin\alpha)\cdot s \\
y'' &= (x' \sin\alpha + y' \cos\alpha)\cdot s
\end{aligned}
\]

3. If `mirror`: \(x'' \leftarrow -x''\)
4. Apply `drawScale`, re-center, apply offsets:

\[
x''' = x'' \cdot \sigma + c_x + \texttt{offsetX},\quad
y''' = y'' \cdot \sigma + c_y + \texttt{offsetY}
\]

where \(\sigma = \texttt{drawScale}\).

These \((x''', y''')\) are written back into `p.x`, `p.y` **temporarily** for stroking; after all instructions, positions restore from `__x__`, `__y__`.

**Line width:** if `scaleLineWidth`, `ctx.lineWidth = instr.scale` (so spiral arms can get thinner).

---

## 9. Path geometry (`drawCurve`)

For each instruction, after the points are transformed:

1. `beginPath()`, `moveTo` first vertex.
2. Let \(n\) be the number of points. With `p1 = curve[1]`, for integer \(i\) from **1** to **\(n - 3\)** inclusive (i.e. `i < lenMinusOne - 1` in the source), let `p2 = curve[i+1]`. The segment uses:

   - **Quadratic Bezier** with control point \((p_{1,x}, p_{1,y})\) and end point at the **midpoint** between `p1` and `p2`:

\[
\text{end} = \left(\frac{p_{1,x}+p_{2,x}}{2},\ \frac{p_{1,y}+p_{2,y}}{2}\right)
\]

3. `stroke()` once per instruction (same `strokeStyle` / `globalAlpha` / composite set by `setColor()`).

So the visible curve is a **smooth approximation** through the moving polyline, not straight segments. With few points, the path is short or empty (the implementation guards `length < 2`).

---

## 10. Color (`setColor`)

Runs at the start of each `draw()`.

- **Composite:** `globalCompositeOperation = "lighter"` for normal strokes (additive RGB clamped per channel by the canvas), or `"source-over"` in eraser mode when colors match the eraser color.
- **Alpha:**

\[
\alpha = \texttt{startOpacity} \cdot \frac{\texttt{life}}{\texttt{startLife}}
\]

Default `startOpacity = 0.09`. The **tail** vertex (newest) has the highest `life`, so the **leading** edge of the stroke is brighter; fading `life` darkens older parts of the chain.

- **Stroke color:** D3 scales map a scalar \(t\) through **HCL interpolation** (`interpolateHcl`), clamped:

  - **`velocity` mode** (default): \(t = \|\vec{v}_{\mathrm{input}}\| = \sqrt{\texttt{inputVx}^2 + \texttt{inputVy}^2}\) on the **last** point; **power scale** exponent **1.5**, domain \([10, 30]\), range \([\texttt{color}, \texttt{highlightColor}]\).
  - **`time` mode:** \(t = \texttt{timeColorScaleTime}\); linear domain \([0, 350]\), range \([\texttt{highlightColor}, \texttt{color}]\).

Default hex colors are both `#276f9b` until the UI changes them.

---

## 11. Sparks (overlay)

On **non-mirror** “original” instructions only, every **10th** `frameTime`, with probability over the curve, a random vertex may spawn a **spark**: small filled circle on a separate canvas, `lighter` blend, drifting with random velocity, fading alpha. Color is `d3.rgb(strokeStyle).brighter(2)` (see [`src/sparks.ts`](../src/sparks.ts)).

---

## 12. Canvas implementation details

- **Clearing / erasing:** Any full-canvas fill or `clearRect` used to **reset** pixels must temporarily set `globalCompositeOperation` to **`source-over"`** and `globalAlpha` to **1**. Under **`lighter`**, filling black does **not** remove existing light pixels (additive with zero does not subtract). See [`src/canvas-util.ts`](../src/canvas-util.ts).
- **HiDPI:** Backing store may be `width_css × devicePixelRatio`; the 2D context is scaled so **logical** drawing coordinates match CSS pixels. Symmetry center and pointer mapping must stay in that same logical space.

---

## 13. Default parameter summary

| Parameter | Default | Effect |
|-----------|---------|--------|
| `startLife` | 150 | Substeps a vertex survives. |
| `startOpacity` | 0.09 | Base alpha (scaled by life). |
| `drawsPerFrame` | 5 | Physics + draw substeps per tick. |
| `friction` | 0.975 | Damping on \((x-p_x)\). |
| `noiseOctaves` / `noiseFallout` | 8 / 0.65 | Coarse vs fine wobble. |
| `noiseAngleScale` | \(5\pi\) | How strongly noise steers direction. |
| `rigidity` | 0.2 | Spring strength between neighbors. |
| `symNumRotations` | 1 | Rotational symmetry order. |
| `symMirror` | true | Bilateral mirror copy. |
| `spiralAngle` | \(0.75\pi\) | Extra twist per spiral copy. |
| `spiralCopies` | 1 (UI may use 30) | Number of spiral arms. |

---

## 14. Further reading in this repo

- [`public/vendor/noise.js`](../public/vendor/noise.js) — Perlin implementation (see **§4**).
- [`SITE-BREAKDOWN.md`](SITE-BREAKDOWN.md) — how the live site bundles scripts and classes.
- [`PERFORMANCE.md`](PERFORMANCE.md) — complexity, canvas cost, and practical limits.
- [`src/silk.ts`](../src/silk.ts) — authoritative implementation for this port.

For attribution and disclaimers, see [README.md](../README.md) (“Original Silk and attribution”).
