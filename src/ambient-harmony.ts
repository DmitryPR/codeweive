/**
 * Diatonic harmony for ambient flow + melody ripple (movable tonic).
 * **Major:** I, ii, iii, IV, V, vi. **Natural minor:** i, iv, v, VI, III, VII (no ii° in the sub register).
 * Picks chords that include the melody pitch when possible, smooth root motion, phrase/cadence bias.
 */

import type { ScaleMode } from "./color-music";

export const AMBIENT_ROOT_HZ = 65.41;

export type DiatonicTriad = {
  readonly roman: string;
  readonly rootPc: number;
  readonly thirdPc: number;
  readonly fifthPc: number;
  readonly quality: "major" | "minor";
};

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Major-key diatonic triads; pitch classes are absolute (0–11). */
export function triadsInMajorKey(tonicPc: number): readonly DiatonicTriad[] {
  const t = mod12(tonicPc);
  return [
    { roman: "I", rootPc: t, thirdPc: mod12(t + 4), fifthPc: mod12(t + 7), quality: "major" },
    { roman: "ii", rootPc: mod12(t + 2), thirdPc: mod12(t + 5), fifthPc: mod12(t + 9), quality: "minor" },
    { roman: "iii", rootPc: mod12(t + 4), thirdPc: mod12(t + 7), fifthPc: mod12(t + 11), quality: "minor" },
    { roman: "IV", rootPc: mod12(t + 5), thirdPc: mod12(t + 9), fifthPc: t, quality: "major" },
    { roman: "V", rootPc: mod12(t + 7), thirdPc: mod12(t + 11), fifthPc: mod12(t + 2), quality: "major" },
    { roman: "vi", rootPc: mod12(t + 9), thirdPc: t, fifthPc: mod12(t + 4), quality: "minor" },
  ] as const;
}

/** Natural-minor diatonic triads (Aeolian); omits diminished ii° for a smoother low pad. */
export function triadsInNaturalMinorKey(tonicPc: number): readonly DiatonicTriad[] {
  const t = mod12(tonicPc);
  return [
    { roman: "i", rootPc: t, thirdPc: mod12(t + 3), fifthPc: mod12(t + 7), quality: "minor" },
    { roman: "iv", rootPc: mod12(t + 5), thirdPc: mod12(t + 8), fifthPc: t, quality: "minor" },
    { roman: "v", rootPc: mod12(t + 7), thirdPc: mod12(t + 10), fifthPc: mod12(t + 2), quality: "minor" },
    { roman: "VI", rootPc: mod12(t + 8), thirdPc: t, fifthPc: mod12(t + 3), quality: "major" },
    { roman: "III", rootPc: mod12(t + 3), thirdPc: mod12(t + 7), fifthPc: mod12(t + 10), quality: "major" },
    { roman: "VII", rootPc: mod12(t + 10), thirdPc: mod12(t + 2), fifthPc: mod12(t + 5), quality: "major" },
  ] as const;
}

export function triadsForKey(tonicPc: number, mode: ScaleMode): readonly DiatonicTriad[] {
  return mode === "naturalMinor" ? triadsInNaturalMinorKey(tonicPc) : triadsInMajorKey(tonicPc);
}

export function triadContainsMelody(t: DiatonicTriad, melodyPc: number): boolean {
  const m = mod12(melodyPc);
  return m === mod12(t.rootPc) || m === mod12(t.thirdPc) || m === mod12(t.fifthPc);
}

function circleDist(a: number, b: number): number {
  const d = Math.abs(mod12(a) - mod12(b));
  return Math.min(d, 12 - d);
}

export type PickChordContext = {
  tonicPc: number;
  melodyPc: number;
  previous: DiatonicTriad | null;
  chordAgeNotes: number;
  minHoldNotes: number;
  /** True when this step is the first note of a phrase (after advance). */
  phraseJustStarted: boolean;
  /** True when this step is the last note of the phrase (before advance). */
  phraseClosing: boolean;
  scaleMode: ScaleMode;
};

function cadenceScoreMajor(c: DiatonicTriad, ctx: PickChordContext): number {
  let score = 0;
  if (ctx.phraseJustStarted && c.roman === "I") score += 2.4;
  if (ctx.phraseClosing && (c.roman === "V" || c.roman === "IV")) score += 1.6;
  if (ctx.phraseClosing && c.roman === "I") score -= 1.2;
  if (c.roman === "I" || c.roman === "IV") score += 0.35;
  if (c.roman === "iii") score -= 0.25;
  return score;
}

function cadenceScoreMinor(c: DiatonicTriad, ctx: PickChordContext): number {
  let score = 0;
  if (ctx.phraseJustStarted && c.roman === "i") score += 2.4;
  if (ctx.phraseClosing && (c.roman === "v" || c.roman === "iv" || c.roman === "VII")) score += 1.6;
  if (ctx.phraseClosing && c.roman === "i") score -= 1.2;
  if (c.roman === "i" || c.roman === "iv") score += 0.35;
  if (c.roman === "III") score -= 0.2;
  return score;
}

/**
 * Pick a triad that includes the melody pitch class when possible, with voice-leading
 * and light cadential bias (mode-aware).
 */
export function pickDiatonicTriad(ctx: PickChordContext): DiatonicTriad {
  const bank = triadsForKey(ctx.tonicPc, ctx.scaleMode);
  const prevRoot = ctx.previous?.rootPc ?? null;

  const fits = bank.filter((c) => triadContainsMelody(c, ctx.melodyPc));
  const candidates = fits.length > 0 ? fits : [...bank];

  let best: DiatonicTriad = candidates[0]!;
  let bestScore = -Infinity;

  for (const c of candidates) {
    let score = 0;
    if (triadContainsMelody(c, ctx.melodyPc)) score += 6;

    if (prevRoot != null) {
      score -= 1.15 * circleDist(prevRoot, c.rootPc);
    }

    score +=
      ctx.scaleMode === "naturalMinor"
        ? cadenceScoreMinor(c, ctx)
        : cadenceScoreMajor(c, ctx);

    if (ctx.previous && ctx.chordAgeNotes < ctx.minHoldNotes) {
      if (c.rootPc === ctx.previous.rootPc && triadContainsMelody(c, ctx.melodyPc)) {
        score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

/** Hz for a pitch class in the same deep register as `AMBIENT_ROOT_HZ` (pc 0 = C). */
export function hzFromPitchClass(pc: number): number {
  return AMBIENT_ROOT_HZ * Math.pow(2, mod12(pc) / 12);
}

/** Interval in semitones from chord root to the upper chord tone (major or minor third). */
export function triadThirdSemitonesFromRoot(quality: "major" | "minor"): number {
  return quality === "major" ? 4 : 3;
}

/**
 * Next chord tone strictly above `melodyPc` within an octave class (for ripple consonance).
 */
export function rippleSemitonesToNextChordTone(melodyPc: number, triad: DiatonicTriad): number {
  const m = mod12(melodyPc);
  const tones = [
    mod12(triad.rootPc),
    mod12(triad.thirdPc),
    mod12(triad.fifthPc),
  ].sort((a, b) => a - b);

  for (const t of tones) {
    if (t > m) return t - m;
  }
  const lowest = tones[0]!;
  return lowest + 12 - m;
}
