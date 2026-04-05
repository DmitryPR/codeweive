/**
 * Map pixels on the silk canvas to the 7 HUD color presets, then drive music (12-TET).
 *
 * **Theory:** Each preset is a **fixed scale degree** (1…7) of a **major** collection:
 * intervals from tonic `[0,2,4,5,7,9,11]` semitones (same as C major when tonic = C).
 * **Tonic pitch class** is **transposed** when **several** colors are active: rounded
 * weighted average of the **reference** chroma (tonic=C case) picks the key center, then
 * every preset’s note is `(tonic + degreeStep) mod 12`. **Solo** color → tonic 0 so
 * absolute pitches match the legacy “always C major” mapping.
 */

import { SILK_COLOR_PRESETS } from "./silk-colors";

export type ColorMusicAnalysis = {
  /** Bit i set if preset i (see `SILK_COLOR_PRESETS`) has visible presence */
  mask: number;
  /** Number of distinct preset colors detected (0–7) */
  distinctCount: number;
  /** Center band dominated by gray preset or neutral low-chroma fill — “salt” for audio */
  centerGraySalt: boolean;
  /** Winning preset index in center band, or null */
  centerPreset: number | null;
  /** Soft mixture of presets (sums to 1) — reflects blended in-between colors */
  presetWeights: readonly number[];
};

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const PRESET_RGB: RGB[] = SILK_COLOR_PRESETS.map((p) => hexToRgb(p.base));

function dist2(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Semitone offset of each preset **from the current tonic** in a major scale
 * (degree 1…7). When `tonicPc === 0`, these are absolute pitch classes C,D,E,F,G,A,B.
 * Order matches `SILK_COLOR_PRESETS`: blue, green, yellow, orange, pink, purple, gray.
 */
export const MAJOR_DEGREE_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/** @alias MAJOR_DEGREE_STEPS — legacy name; chroma when tonic is C. */
export const COLOR_INDEX_TO_SEMITONE: readonly number[] = MAJOR_DEGREE_STEPS;

/** Per-pixel fuzzy assignment to all 7 presets (inverse-distance²); sums to 1. */
function softPresetWeightsForRgb(r: number, g: number, b: number): number[] {
  const px: RGB = { r, g, b };
  let sum = 0;
  const raw = new Array<number>(7);
  for (let i = 0; i < 7; i++) {
    const d = Math.sqrt(dist2(px, PRESET_RGB[i]!)) + 5;
    const v = 1 / (d * d);
    raw[i] = v;
    sum += v;
  }
  for (let i = 0; i < 7; i++) {
    raw[i] = raw[i]! / sum;
  }
  return raw;
}

function nearestPreset(r: number, g: number, b: number): { idx: number; dist: number } {
  let bestI = 0;
  let bestD = Infinity;
  const px: RGB = { r, g, b };
  for (let i = 0; i < PRESET_RGB.length; i++) {
    const d = dist2(px, PRESET_RGB[i]!);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return { idx: bestI, dist: bestD };
}

/** Max RGB distance² to accept a match (avoid classifying noise as a preset). */
const MATCH_MAX_DIST2 = 8_800;
const BG_LUMA = 0.038;

/**
 * Single full-canvas `ImageData` pass: strided samples for mask + denser votes in center band.
 */
export function analyzeSilkImageData(imageData: ImageData): ColorMusicAnalysis {
  const cw = imageData.width;
  const ch = imageData.height;
  const d = imageData.data;
  const step = Math.max(10, Math.min(26, Math.floor(Math.min(cw, ch) / 18)));

  let mask = 0;
  const weightAcc = new Array<number>(7).fill(0);
  let weightSamples = 0;
  const centerVote = new Array<number>(7).fill(0);
  let centerSamples = 0;

  const csx0 = Math.floor(cw * 0.32);
  const csx1 = Math.floor(cw * 0.68);
  const csy0 = Math.floor(ch * 0.32);
  const csy1 = Math.floor(ch * 0.68);

  for (let y = 0; y < ch; y += step) {
    for (let x = 0; x < cw; x += step) {
      const i = (Math.min(ch - 1, y) * cw + Math.min(cw - 1, x)) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luma < BG_LUMA) continue;

      const { idx, dist } = nearestPreset(r, g, b);
      if (dist > MATCH_MAX_DIST2) continue;

      mask |= 1 << idx;

      const soft = softPresetWeightsForRgb(r, g, b);
      for (let j = 0; j < 7; j++) {
        weightAcc[j] = (weightAcc[j] ?? 0) + soft[j]!;
      }
      weightSamples++;

      if (x >= csx0 && x < csx1 && y >= csy0 && y < csy1) {
        centerVote[idx] = (centerVote[idx] ?? 0) + 1;
        centerSamples++;
      }
    }
  }

  let centerPreset: number | null = null;
  let centerGraySalt = false;

  if (centerSamples > 0) {
    let maxV = 0;
    let arg = 0;
    for (let j = 0; j < 7; j++) {
      const v = centerVote[j] ?? 0;
      if (v > maxV) {
        maxV = v;
        arg = j;
      }
    }
    centerPreset = arg;
    const grayShare = (centerVote[6] ?? 0) / centerSamples;
    const winnerShare = maxV / centerSamples;
    centerGraySalt =
      grayShare > 0.32 ||
      (arg === 6 && winnerShare > 0.24);
  }

  let distinctCount = 0;
  for (let j = 0; j < 7; j++) {
    if (mask & (1 << j)) distinctCount++;
  }

  const presetWeights: number[] = new Array(7).fill(0);
  if (weightSamples > 0) {
    for (let j = 0; j < 7; j++) {
      presetWeights[j] = (weightAcc[j] ?? 0) / weightSamples;
    }
  } else {
    presetWeights[0] = 1;
  }

  return {
    mask,
    distinctCount,
    centerGraySalt,
    centerPreset,
    presetWeights,
  };
}

function activePresetIndices(mask: number, weights?: readonly number[]): number[] {
  const s = new Set<number>();
  for (let i = 0; i < 7; i++) {
    if (mask & (1 << i)) s.add(i);
  }
  if (s.size === 0 && weights && weights.length >= 7) {
    for (let i = 0; i < 7; i++) {
      if ((weights[i] ?? 0) > 0.02) s.add(i);
    }
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Tonic pitch class (0–11) for **movable** major: with **one** active hue, returns **0**
 * so solo presets keep legacy absolute pitches. With **two or more**, returns rounded
 * weighted mean of reference chroma (`MAJOR_DEGREE_STEPS` as C-key pitch classes).
 */
export function tonicPitchClassFromAnalysis(
  mask: number,
  weights?: readonly number[],
): number {
  const act = activePresetIndices(mask, weights);
  if (act.length <= 1) return 0;

  let num = 0;
  let den = 0;
  if (weights && weights.length >= 7) {
    for (const i of act) {
      const w = weights[i] ?? 0;
      num += w * MAJOR_DEGREE_STEPS[i]!;
      den += w;
    }
  }
  if (den < 1e-9) {
    for (const i of act) {
      num += MAJOR_DEGREE_STEPS[i]!;
    }
    den = act.length;
  }

  return ((Math.round(num / den) % 12) + 12) % 12;
}

export function presetPitchClass(presetIndex: number, tonicPc: number): number {
  const step = MAJOR_DEGREE_STEPS[presetIndex];
  if (step == null) return 0;
  return (tonicPc + step) % 12;
}

/** Weighted average pitch class (fractional) under the current movable tonic. */
export function centroidSemitoneFromWeights(
  weights: readonly number[],
  mask: number,
): number {
  if (weights.length < 7) return 0;
  const tonic = tonicPitchClassFromAnalysis(mask, weights);
  let s = 0;
  for (let i = 0; i < 7; i++) {
    s += (weights[i] ?? 0) * presetPitchClass(i, tonic);
  }
  return s;
}

/** Pitch classes (0–11) for mask bits, sorted — transposed by movable tonic. */
export function semitonesFromPresetMask(mask: number): number[] {
  const tonic = tonicPitchClassFromAnalysis(mask);
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (mask & (1 << i)) {
      out.push(presetPitchClass(i, tonic));
    }
  }
  out.sort((a, b) => a - b);
  return out.length > 0 ? out : [0];
}

/**
 * Melody pool from **soft** weights (blends) ∪ hard mask: any preset above `threshold`
 * contributes its pitch class; falls back to mask-only if empty.
 */
export function semitonesFromWeightsAndMask(
  weights: readonly number[] | undefined,
  mask: number,
  threshold = 0.052,
): number[] {
  const tonic = tonicPitchClassFromAnalysis(mask, weights);
  const semis = new Set<number>();
  if (weights && weights.length >= 7) {
    for (let i = 0; i < 7; i++) {
      if ((weights[i] ?? 0) >= threshold) {
        semis.add(presetPitchClass(i, tonic));
      }
    }
  }
  if (semis.size === 0) {
    return semitonesFromPresetMask(mask);
  }
  return [...semis].sort((a, b) => a - b);
}
