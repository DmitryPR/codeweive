/**
 * Parametric standing-wave field (Chladni-style rectangular modes + weak hex / Faraday-like sum).
 * Shared by ambient audio: the “virtual plate” is driven from palette centroid, color count,
 * symmetry, and ink — no separate visual overlay.
 */

export type StandingWaveParams = {
  timeSec: number;
  centroidSemitone: number;
  distinctCount: number;
  symRotations: number;
  inkStrength: number;
};

/** Three-plane-wave sum → roughly hexagonal cellular structure. */
function hexField(u: number, v: number, k: number, t: number): number {
  const c = Math.cos;
  const a1 = k * u + t * 0.7;
  const a2 = k * (-0.5 * u + 0.8660254037844386 * v) + t * 0.53;
  const a3 = k * (-0.5 * u - 0.8660254037844386 * v) - t * 0.61;
  return (c(a1) + c(a2) + c(a3)) / 3;
}

function modeNM(
  u: number,
  v: number,
  n: number,
  m: number,
  phase: number,
): number {
  return (
    Math.sin(n * Math.PI * u + phase) * Math.sin(m * Math.PI * v + phase * 0.73)
  );
}

/** Scalar field in [-1, 1] at normalized coordinates u,v ∈ (0,1). */
export function sampleStandingWaveField(
  u: number,
  v: number,
  p: StandingWaveParams,
): number {
  const c = p.centroidSemitone;
  const n1 = 1 + (Math.floor(c) % 5);
  const m1 = 1 + (Math.floor(c * 1.618033988749895) % 5);
  const n2 = 1 + (Math.floor(c * 2.71) % 4);
  const m2 = 1 + (Math.floor(c * 0.7 + 2) % 5);
  const t = p.timeSec;
  const rot = Math.max(1, Math.min(12, Math.round(p.symRotations)));
  const hexK = (2.6 + (rot % 5) * 0.55 + (p.distinctCount % 4) * 0.35) * Math.PI;

  const wRect =
    0.55 + 0.25 * Math.min(1, p.distinctCount / 5) + 0.15 * Math.sin(t * 0.2);
  const wHex =
    0.22 +
    0.12 * Math.sin(t * 0.11) +
    0.08 * Math.min(1, rot / 8) +
    0.1 * Math.min(1, p.inkStrength);

  const ph1 = t * 0.42 + c * 0.15;
  const ph2 = -t * 0.31 + c * 0.09;
  const rect =
    0.62 * modeNM(u, v, n1, m1, ph1) + 0.38 * modeNM(u, v, n2, m2, ph2);
  const hex = hexField(u, v, hexK, t * 0.95);

  const mix = wRect * rect + wHex * hex;
  return Math.tanh(mix * 1.35);
}

/** ∂f/∂t via small time step (for “surface velocity” in audio). */
export function sampleStandingWaveVelocity(
  u: number,
  v: number,
  p: StandingWaveParams,
  dtSec: number,
): number {
  if (dtSec < 1e-6) return 0;
  const f0 = sampleStandingWaveField(u, v, p);
  const f1 = sampleStandingWaveField(u, v, {
    ...p,
    timeSec: p.timeSec + dtSec,
  });
  return (f1 - f0) / dtSec;
}
