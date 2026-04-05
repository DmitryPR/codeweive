# Harmonic melody phrases (color → ambient)

High-level product description, file map, and **ambient next steps** live in [FEATURE.md](FEATURE.md) § **Ambient sound**. This doc focuses on **harmony**, the **standing-wave / plate** stack, **phrase patterns**, and how they interact.

## Blends and the melody pool

Strokes are often **between** HUD presets (velocity / interpolation). The analyzer keeps:

- A **hard mask** (which presets clearly appear), and  
- **`presetWeights`** — a **soft mixture** over all seven presets (inverse-distance per pixel, averaged; sums to 1).

### Movable tonic (major) + fixed scale degrees

Each preset is a **fixed degree** in **major**: blue = 1, green = 2, … gray = 7, with semitone offsets from tonic **`[0,2,4,5,7,9,11]`** (`MAJOR_DEGREE_STEPS` in [`color-music.ts`](../src/color-music.ts)). Pitch class for preset *i* is **`(tonic + step[i]) mod 12`** in 12-TET.

- **One** active color (mask / weights): **`tonic = 0`** — same **absolute** mapping as the original “always C major” prototype (solo blue → C, solo yellow → E, etc.).
- **Two or more** colors: **`tonic`** = **rounded weighted mean** of those presets’ reference chroma (the steps above treated as pitch classes in C), **mod 12**. The whole **degree collection transposes** together — phrases still index **sorted pool positions** (low → high), but the **key center** follows the **mixed** image.

The **melody pool** uses any preset above a weight **threshold** (fallback: mask); each contributes its **transposed** pitch class. The **flow centroid** uses the same tonic-aware weighted average so the drone **glides** with the **current key**.

## Flow bed + standing-wave field + strokes-as-plate + delay (water register)

The **base** is intentionally **dark and low** — no separate treble layer:

1. **Flow** — three **sine** partials at **C2-class** (½× sub, centroid root, fifth) following the **smoothed color centroid** with slow **detune drift** (slow, liquid motion).
2. **Standing-wave field** — parametric surface in [`src/standing-waves.ts`](../src/standing-waves.ts) (rectangular modes + weak hex / Faraday-like sum). **Centroid**, **distinct preset count**, **HUD rotations**, **ink** (brightness + motion + energy), and **time** set the field. An **orbiting listen point** \((u,v)\) samples it for motion (**∂f/∂t**) and drives nodal/antinodal **breathing** on the triad, **delay time**, and **feedback**.
3. **Strokes as the plate** — on the same cadence as full-canvas color analysis (~every 20 ticks), [`src/plate-coupling.ts`](../src/plate-coupling.ts) walks a **strided grid** over the silk `ImageData`, treats **luma above background** as **ink mass**, and accumulates ink-weighted statistics of **\(f\)** at each \((u,v)\):
   - **`meanF`** — average field under strokes (crests vs troughs);
   - **`rmsF`** — typical **\(|f|\)** under strokes (how strongly the mode “wiggles” where you drew);
   - **`coverage`** — how much of the sampled canvas carries ink.  
   These feed the ambient engine (smoothed) to **detune** the flow partials, **scale** flow and fluid gains, **boost** filtered noise when strokes sit in active parts of the mode, **tighten** phrase timing when overlap is strong, **nudge** phrase pitch and delay, and slightly **open** the master low-pass — always still capped in the **subdued** band.
4. **Fluid noise** — looping **brown-ish** noise through a **low-pass**; gain and cutoff track field motion **and** plate overlap so agitation rises when your drawing **rides** the virtual standing wave.
5. **Master low-pass** — the mix stays roughly **0.5–1.1 kHz**; plate **RMS** only adds a **small** upward nudge within that philosophy.
6. **Trails** — the **phrase** line stays in the **deep root** (no octave lift), through **delay** + **feedback**; overlap and **`meanF`** gently **modulate** delay time and microtonal offset.

Phrase melodies stay **phrase‑shaped** but **quieter** and **slower** so the flow reads as **continuous water-like texture**. There is **no** standing-wave **canvas** layer — coupling is **audio-only**, driven by the **same** field math and **actual** stroke pixels.

## Closed loop: melody ↔ drawing

Ambient exposes **`getDriveState()`** (see [`src/ambient-sound.ts`](../src/ambient-sound.ts)) while sound is enabled:

- **`flowPhase`** — phase integrated from the **flow root Hz** each frame (with light modulation from the standing field and plate RMS), kept in a bounded range.
- **`melodyHz`** — the **current phrase lead** pitch (deep register).
- **`ripple`** — a 0–1 blend of wave velocity, plate RMS, and \(|f|\) at the listen point.
- **`baseFlowHz`** — centroid root for the triad.

**Drawing:** [`src/app.ts`](../src/app.ts) turns that into a **smoothed Lissajous-like offset** (a few logical pixels) added to **new** `addPoint` positions while you drag or auto-draw. Velocity passed into the silk still comes from the **real pointer**, so the stroke “shimmers” with the water field without fighting your hand. The pattern you see is therefore **partly a trace of the evolving harmony** — not a literal waveform plot, but **geometrically biased** by the same clock as the audio.

**Second voice:** a very quiet **sine a perfect fifth above** the lead is summed into the **same** lead gain → delay path, so ripples add a **harmonic shimmer** under the main phrase (still low-passed).

## Phrase book (implemented in [`src/ambient-phrases.ts`](../src/ambient-phrases.ts))

Each step is an index into the **sorted** active pitch‑class pool (lowest = `0`). Phrase notes get a **small microtonal nudge** from the centroid fraction so lines sit “between” colors when the image does, plus a **subtle bias** from ink-weighted **`meanF`** (stroke–plate overlap) so the melody **leans** with where the drawing sits on the mode.

| ID | Name | Degree pattern (pool indices) | Idea |
|----|------|-------------------------------|------|
| `home-pulse` | Home pulse | 0, 0, 1, 0 | Rest on low color, upper neighbor, return. |
| `doorstep` | Doorstep | 0, 1, 0 | Minimal neighbor tone. |
| `small-wave` | Small wave | 0, 1, 2, 1, 0 | Small arch up and down. |
| `linger-high` | Linger high | 0, 1, 2, 2, 1, 0 | Repeat top step before descending. |
| `skip-home` | Skip and home | 0, 2, 1, 0 | Skip within pool, then stepwise home. |
| `upper-pedal` | Upper pedal | 1, 0, 2, 0 | Pivot on middle of pool. |
| `full-ladder` | Full ladder | 0, 1, 2, 3, 2, 1, 0 | Long walk; wraps if fewer colors. |
| `mountain` | Mountain | 2, 1, 0, 1, 2 | Symmetric peak shape. |

Phrases **advance in order** (0 → 7, then wrap).

## Few colors on screen

If only **one** strong color dominates, the pool may collapse to one pitch — phrases still give **rhythmic** motion. **Soft weights** often keep a **trace** of secondary presets in blends, which widens the pool slightly compared to a hard mask alone.

## Gray center

When the **center** reads as the **gray** preset (see `color-music` analysis), the **middle flow** sine layer gets a small **gain swell** only — no upper partials or vibrato.

## Related code

- [`src/color-music.ts`](../src/color-music.ts) — `MAJOR_DEGREE_STEPS`, `tonicPitchClassFromAnalysis`, `presetPitchClass`, `centroidSemitoneFromWeights(weights, mask)`, `semitonesFromWeightsAndMask`.
- [`src/ambient-sound.ts`](../src/ambient-sound.ts) — flow, standing-wave + plate coupling, fluid noise, harmonic ripple voice, `getDriveState`, low-pass, delay, levels.
- [`src/standing-waves.ts`](../src/standing-waves.ts) — `sampleStandingWaveField` / `sampleStandingWaveVelocity`.
- [`src/plate-coupling.ts`](../src/plate-coupling.ts) — `plateCouplingFromImageData` (strokes × field).
- [`docs/FEATURE.md`](FEATURE.md) — ambient overview, architecture, **Next steps (ambient)**.

## Next steps (melody & coupling)

Aligned with [FEATURE.md](FEATURE.md); melody-specific angles:

| Direction | Notes |
|-----------|--------|
| **Phrase variety** | New patterns in [`ambient-phrases.ts`](../src/ambient-phrases.ts), or **weighted random** phrase choice from pool density. |
| **Pool / tuning** | Lower weight threshold when blends are **sparse**; **cap** phrase speed when only one pitch class is active. |
| **Plate ↔ phrase** | Expose **`rmsF`** or **`meanF`** bands to **accent** certain scale degrees (e.g. emphasize roots when strokes sit on nodal lines). |
| **Ripple voice** | Detune fifth, add **third** or **sub-octave** duplicate with independent delay send. |
| **Closed loop** | Scale **Lissajous dither** by **`ripple`** or user slider; optional **auto-draw-only** so manual strokes stay pure. |
| **Reproducibility** | **Seed** phrase order + analysis stride from URL hash for shareable “scores.” |
