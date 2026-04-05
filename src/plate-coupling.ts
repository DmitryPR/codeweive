/**
 * Treat silk strokes as mass on the same standing-wave field as audio (`standing-waves.ts`).
 * Downsampled luma × field overlap → coupling scalars for the ambient engine.
 */

import { sampleStandingWaveField, type StandingWaveParams } from "./standing-waves";

/** Match `color-music` background cutoff (normalized luma). */
const BG_LUMA = 0.038;

export type PlateCoupling = {
  /** Ink-weighted mean field ∈ [-1, 1] — strokes on crests vs troughs of the mode */
  meanF: number;
  /** sqrt(ink-weighted mean f²) — how strongly the mode undulates under drawn ink */
  rmsF: number;
  /** Fraction of strided samples that carry visible ink */
  coverage: number;
};

/**
 * Strided full-canvas scan. O(width×height / step²) — keep step ≥ ~10.
 */
export function plateCouplingFromImageData(
  imageData: ImageData,
  p: StandingWaveParams,
): PlateCoupling {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const step = Math.max(10, Math.min(28, Math.floor(Math.min(w, h) / 16)));

  let sumInk = 0;
  let sumInkF = 0;
  let sumInkF2 = 0;
  let samples = 0;
  let inkPixels = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const ink = luma < BG_LUMA ? 0 : luma;
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const f = sampleStandingWaveField(u, v, p);
      samples++;
      if (ink > 0.04) {
        inkPixels++;
        sumInk += ink;
        sumInkF += ink * f;
        sumInkF2 += ink * f * f;
      }
    }
  }

  const coverage = inkPixels / Math.max(1, samples);
  if (sumInk < 1e-5) {
    return { meanF: 0, rmsF: 0, coverage };
  }

  const meanF = sumInkF / sumInk;
  const rmsF = Math.sqrt(Math.max(0, sumInkF2 / sumInk));
  return { meanF, rmsF, coverage };
}
