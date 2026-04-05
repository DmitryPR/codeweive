/**
 * Harmonic melody phrases for ambient sound.
 * Each `degrees` entry is an index into the **sorted** active color→pitch pool (0 = lowest note present).
 * Patterns are designed to stay consonant: neighbors, small arches, and returns to the low “tonic” color.
 */

export type HarmonicPhraseMeta = {
  id: string;
  name: string;
  degrees: readonly number[];
  idea: string;
};

export const HARMONIC_PHRASES: readonly HarmonicPhraseMeta[] = [
  {
    id: "home-pulse",
    name: "Home pulse",
    degrees: [0, 0, 1, 0],
    idea: "Stay on the lowest color, brief upper neighbor, resolve back — gentle heartbeat on the root.",
  },
  {
    id: "doorstep",
    name: "Doorstep",
    degrees: [0, 1, 0],
    idea: "Short neighbor motion; works even with only two colors on screen.",
  },
  {
    id: "small-wave",
    name: "Small wave",
    degrees: [0, 1, 2, 1, 0],
    idea: "Rise through the pool then stepwise return; classic arch, still stepwise (consonant).",
  },
  {
    id: "linger-high",
    name: "Linger high",
    degrees: [0, 1, 2, 2, 1, 0],
    idea: "Touches the top of the available colors twice before descending — calm emphasis on the bright hue.",
  },
  {
    id: "skip-home",
    name: "Skip and home",
    degrees: [0, 2, 1, 0],
    idea: "Wider skip within the pool (still only played colors), then fill the gap — outline without chromatic clutter.",
  },
  {
    id: "upper-pedal",
    name: "Upper pedal",
    degrees: [1, 0, 2, 0],
    idea: "Middle color as pivot, visits low and high available pitches — stable center.",
  },
  {
    id: "full-ladder",
    name: "Full ladder",
    degrees: [0, 1, 2, 3, 2, 1, 0],
    idea: "Walk up and down the sorted color pitches; with fewer than four colors, indices wrap modulo pool size.",
  },
  {
    id: "mountain",
    name: "Mountain",
    degrees: [2, 1, 0, 1, 2],
    idea: "Peak in the middle of the pool range, symmetric descent and re-ascent — soft melodic contour.",
  },
] as const;

export function getPhraseCount(): number {
  return HARMONIC_PHRASES.length;
}

export function getPhraseDegrees(phraseIndex: number): readonly number[] {
  return HARMONIC_PHRASES[phraseIndex % HARMONIC_PHRASES.length]!.degrees;
}
