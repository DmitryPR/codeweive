/**
 * Procedural ambient (GitHub Pages): Web Audio only.
 * Low, water-like flow: sub-heavy drifting triad + soft delayed phrase line,
 * modulated by a shared standing-wave field (see `standing-waves.ts`)
 * (palette centroid, color spread, rotational symmetry, ink).
 * Filtered brown-noise “fluid” follows |field| and ∂f/∂t for motion.
 * Canvas strokes overlap the field (`plate-coupling.ts`) to couple “mass on the plate”.
 * No high-band oscillators; master low-pass keeps everything dark and smooth.
 */

import {
  hzFromPitchClass,
  pickDiatonicTriad,
  rippleSemitonesToNextChordTone,
  triadContainsMelody,
  triadThirdSemitonesFromRoot,
  triadsForKey,
  type DiatonicTriad,
  AMBIENT_ROOT_HZ,
} from "./ambient-harmony";
import { getPhraseDegrees, getPhraseCount } from "./ambient-phrases";
import {
  centroidSemitoneFromWeights,
  inferScaleModeFromVisuals,
  semitonesFromWeightsAndMask,
  tonicPitchClassFromAnalysis,
  topWeightedPitchClasses,
  type ScaleMode,
} from "./color-music";
import {
  sampleStandingWaveField,
  sampleStandingWaveVelocity,
  type StandingWaveParams,
} from "./standing-waves";

/** Read-only snapshot for drawing feedback (`app` dithers strokes from phase / ripple). */
export type AmbientDriveState = {
  /** Last phrase lead frequency (Hz), deep register */
  melodyHz: number;
  /** Integrated flow phase (rad); advances with `baseFlowHz` each update */
  flowPhase: number;
  /** 0–1 “surface chop” from standing wave + plate */
  ripple: number;
  /** Smoothed centroid root (Hz) for the flow triad */
  baseFlowHz: number;
};

export type AmbientHints = {
  motion: number;
  energy: number;
  canvasBrightness?: number;
  colorPresetMask?: number;
  colorDistinctCount?: number;
  centerGraySalt?: boolean;
  colorPresetWeights?: readonly number[];
  /** HUD rotational symmetry (1–12) — shapes hex / mode mix in standing-wave field */
  symRotations?: number;
  /** Ink-weighted mean of standing field under strokes ∈ [-1, 1] */
  plateMeanField?: number;
  /** RMS of field under strokes — mode energy where you drew */
  plateRms?: number;
  /** Share of canvas samples with ink (strided) */
  plateCoverage?: number;
  /**
   * `phrase` — stepped melody from `ambient-phrases` through the color pool.
   * `blend` (default) — **continuous** pitch from weighted color centroid + up to three
   * quiet partials for the strongest presets (literal “combination” tones).
   */
  colorMelodyMode?: "phrase" | "blend";
  /** Override diatonic collection: major vs natural minor (default: inferred from canvas). */
  scaleMode?: ScaleMode;
};

/** C2 — deep register; melody and flow stay sub / low-mid only */
const ROOT_HZ = AMBIENT_ROOT_HZ;

/** Default: centroid + multi-partial “blend”; set hints.colorMelodyMode to `"phrase"` for the old line. */
const DEFAULT_COLOR_MELODY_MODE: "phrase" | "blend" = "blend";

function getAudioContextCtor(): typeof AudioContext | null {
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createAmbientSound(): {
  setEnabled(on: boolean): Promise<void>;
  isEnabled(): boolean;
  update(hints: AmbientHints): void;
  getDriveState(): AmbientDriveState | null;
  resumeIfNeeded(): void;
  dispose(): void;
} {
  const Ctor = getAudioContextCtor();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let warmFilter: BiquadFilterNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;

  let flowOsc0: OscillatorNode | null = null;
  let flowGain0: GainNode | null = null;
  let flowOsc1: OscillatorNode | null = null;
  let flowGain1: GainNode | null = null;
  let flowOsc2: OscillatorNode | null = null;
  let flowGain2: GainNode | null = null;

  let melodyOsc: OscillatorNode | null = null;
  let melodyGain: GainNode | null = null;
  let melodyDryGain: GainNode | null = null;
  let melodyDelay: DelayNode | null = null;
  let melodyDelayWet: GainNode | null = null;
  let melodyDelayFb: GainNode | null = null;
  let melodyRippleOsc: OscillatorNode | null = null;
  let melodyRippleGain: GainNode | null = null;

  let fluidNoiseSrc: AudioBufferSourceNode | null = null;
  let fluidLp: BiquadFilterNode | null = null;
  let fluidGain: GainNode | null = null;

  let comboOsc0: OscillatorNode | null = null;
  let comboGain0: GainNode | null = null;
  let comboOsc1: OscillatorNode | null = null;
  let comboGain1: GainNode | null = null;
  let comboOsc2: OscillatorNode | null = null;
  let comboGain2: GainNode | null = null;

  const toStop: AudioScheduledSourceNode[] = [];

  let enabled = false;
  let graphBuilt = false;

  let smoothMotion = 0;
  let smoothEnergy = 0;
  let smoothBright = 0.08;
  let smoothCentroidSemi = 3.5;
  let smoothWaveField = 0;
  let smoothWaveVel = 0;
  let waveListenAngle = 0;
  let smoothPlateMean = 0;
  let smoothPlateRms = 0;
  let smoothPlateCov = 0;

  let phraseIndex = 0;
  let noteInPhrase = 0;
  let lastNoteMs = 0;
  let lastMelodyHz = ROOT_HZ;
  let lastMelodyPc = 0;
  let harmonyTriad: DiatonicTriad = triadsForKey(0, "major")[0]!;
  let chordAgeNotes = 0;
  let lastChordPickMs = 0;
  let lastFlowRootHz = ROOT_HZ;
  let lastDriveNow = performance.now();
  let flowPhaseAccum = 0;

  function buildGraph(): void {
    if (!Ctor || graphBuilt) return;
    ctx = new Ctor();
    graphBuilt = true;
    lastNoteMs = performance.now();

    master = ctx.createGain();
    master.gain.value = 0;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -26;
    compressor.knee.value = 36;
    compressor.ratio.value = 1.65;
    compressor.attack.value = 0.06;
    compressor.release.value = 0.48;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    warmFilter = ctx.createBiquadFilter();
    warmFilter.type = "lowpass";
    warmFilter.frequency.value = 900;
    warmFilter.Q.value = 0.28;
    warmFilter.connect(master);

    const mix = ctx.createGain();
    mix.gain.value = 1;
    mix.connect(warmFilter);

    flowOsc0 = ctx.createOscillator();
    flowOsc0.type = "sine";
    flowOsc0.frequency.value = ROOT_HZ * 0.5;
    flowGain0 = ctx.createGain();
    flowGain0.gain.value = 0.04;
    flowOsc0.connect(flowGain0);
    flowGain0.connect(mix);
    flowOsc0.start();
    toStop.push(flowOsc0);

    flowOsc1 = ctx.createOscillator();
    flowOsc1.type = "sine";
    flowOsc1.frequency.value = ROOT_HZ;
    flowGain1 = ctx.createGain();
    flowGain1.gain.value = 0.034;
    flowOsc1.connect(flowGain1);
    flowGain1.connect(mix);
    flowOsc1.start();
    toStop.push(flowOsc1);

    flowOsc2 = ctx.createOscillator();
    flowOsc2.type = "sine";
    flowOsc2.frequency.value = ROOT_HZ * Math.pow(2, 4 / 12);
    flowGain2 = ctx.createGain();
    flowGain2.gain.value = 0.028;
    flowOsc2.connect(flowGain2);
    flowGain2.connect(mix);
    flowOsc2.start();
    toStop.push(flowOsc2);

    melodyOsc = ctx.createOscillator();
    melodyOsc.type = "sine";
    melodyOsc.frequency.value = ROOT_HZ;
    melodyGain = ctx.createGain();
    melodyGain.gain.value = 0;
    melodyDryGain = ctx.createGain();
    melodyDryGain.gain.value = 0.55;
    melodyDelay = ctx.createDelay(1.2);
    melodyDelay.delayTime.value = 0.52;
    melodyDelayWet = ctx.createGain();
    melodyDelayWet.gain.value = 0.22;
    melodyDelayFb = ctx.createGain();
    melodyDelayFb.gain.value = 0.1;

    melodyOsc.connect(melodyGain);
    melodyRippleOsc = ctx.createOscillator();
    melodyRippleOsc.type = "sine";
    melodyRippleGain = ctx.createGain();
    melodyRippleGain.gain.value = 0;
    melodyRippleOsc.connect(melodyRippleGain);
    melodyRippleGain.connect(melodyGain);
    melodyGain.connect(melodyDryGain);
    melodyDryGain.connect(mix);
    melodyGain.connect(melodyDelay);
    melodyDelay.connect(melodyDelayWet);
    melodyDelayWet.connect(mix);
    melodyDelay.connect(melodyDelayFb);
    melodyDelayFb.connect(melodyDelay);

    melodyOsc.start();
    toStop.push(melodyOsc);
    melodyRippleOsc.frequency.value = ROOT_HZ * 1.498307077;
    melodyRippleOsc.start();
    toStop.push(melodyRippleOsc);

    comboOsc0 = ctx.createOscillator();
    comboOsc0.type = "sine";
    comboOsc0.frequency.value = ROOT_HZ;
    comboGain0 = ctx.createGain();
    comboGain0.gain.value = 0;
    comboOsc0.connect(comboGain0);
    comboGain0.connect(mix);
    comboOsc0.start();
    toStop.push(comboOsc0);

    comboOsc1 = ctx.createOscillator();
    comboOsc1.type = "sine";
    comboOsc1.frequency.value = ROOT_HZ;
    comboGain1 = ctx.createGain();
    comboGain1.gain.value = 0;
    comboOsc1.connect(comboGain1);
    comboGain1.connect(mix);
    comboOsc1.start();
    toStop.push(comboOsc1);

    comboOsc2 = ctx.createOscillator();
    comboOsc2.type = "sine";
    comboOsc2.frequency.value = ROOT_HZ;
    comboGain2 = ctx.createGain();
    comboGain2.gain.value = 0;
    comboOsc2.connect(comboGain2);
    comboGain2.connect(mix);
    comboOsc2.start();
    toStop.push(comboOsc2);

    const nSamp = Math.max(2048, Math.floor(ctx.sampleRate * 1.25));
    const nb = ctx.createBuffer(1, nSamp, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < nSamp; i++) {
      brown = brown * 0.965 + (Math.random() * 2 - 1) * 0.22;
      nd[i] = Math.max(-1, Math.min(1, brown * 0.55));
    }
    fluidNoiseSrc = ctx.createBufferSource();
    fluidNoiseSrc.buffer = nb;
    fluidNoiseSrc.loop = true;
    fluidLp = ctx.createBiquadFilter();
    fluidLp.type = "lowpass";
    fluidLp.frequency.value = 480;
    fluidLp.Q.value = 0.42;
    fluidGain = ctx.createGain();
    fluidGain.gain.value = 0;
    fluidNoiseSrc.connect(fluidLp);
    fluidLp.connect(fluidGain);
    fluidGain.connect(mix);
    fluidNoiseSrc.start();
    toStop.push(fluidNoiseSrc);
  }

  function rampMaster(to: number, seconds: number): void {
    if (!ctx || !master) return;
    const g = master.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + seconds);
  }

  async function setEnabled(on: boolean): Promise<void> {
    enabled = on;
    if (!Ctor) return;

    if (on) {
      buildGraph();
      if (!ctx || !master || !melodyOsc || !melodyGain) return;
      phraseIndex = 0;
      noteInPhrase = 0;
      lastNoteMs = performance.now();
      lastMelodyHz = ROOT_HZ;
      lastDriveNow = performance.now();
      flowPhaseAccum = 0;
      harmonyTriad = triadsForKey(0, "major")[0]!;
      chordAgeNotes = 0;
      lastChordPickMs = performance.now();
      lastFlowRootHz = ROOT_HZ;
      lastMelodyPc = 0;
      const t = ctx.currentTime;
      melodyOsc.frequency.setValueAtTime(ROOT_HZ, t);
      if (melodyRippleOsc) {
        melodyRippleOsc.frequency.setValueAtTime(ROOT_HZ * 1.498307077, t);
      }
      melodyGain.gain.setValueAtTime(0, t);
      melodyOsc.detune.setValueAtTime(0, t);
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
      rampMaster(0.1, 0.65);
    } else if (ctx && master) {
      rampMaster(0, 0.45);
    }
  }

  function visualPresence(m: number, e: number, b: number): number {
    const raw = 0.45 * b + 0.35 * e + 0.2 * m;
    return Math.max(0, Math.min(1, raw * 1.15));
  }

  function update(hints: AmbientHints): void {
    if (
      !enabled ||
      !ctx ||
      !warmFilter ||
      !flowOsc0 ||
      !flowGain0 ||
      !flowOsc1 ||
      !flowGain1 ||
      !flowOsc2 ||
      !flowGain2 ||
      !melodyOsc ||
      !melodyGain ||
      !melodyDryGain ||
      !melodyDelay ||
      !melodyDelayWet ||
      !melodyDelayFb ||
      !melodyRippleOsc ||
      !melodyRippleGain ||
      !comboOsc0 ||
      !comboGain0 ||
      !comboOsc1 ||
      !comboGain1 ||
      !comboOsc2 ||
      !comboGain2 ||
      !fluidLp ||
      !fluidGain
    ) {
      return;
    }

    const m = Math.max(0, Math.min(1, hints.motion));
    const e = Math.max(0, Math.min(1, hints.energy));
    smoothMotion = smoothMotion * 0.88 + m * 0.12;
    smoothEnergy = smoothEnergy * 0.9 + e * 0.1;
    if (hints.canvasBrightness != null) {
      const b = Math.max(0, Math.min(1, hints.canvasBrightness));
      smoothBright = smoothBright * 0.82 + b * 0.18;
    }

    const mask = hints.colorPresetMask ?? 0;
    const weights = hints.colorPresetWeights;
    const scaleMode: ScaleMode =
      hints.scaleMode ??
      inferScaleModeFromVisuals(hints.canvasBrightness, hints.centerGraySalt);
    const pool = semitonesFromWeightsAndMask(weights, mask, 0.052, scaleMode);
    const k = Math.max(1, Math.min(7, hints.colorDistinctCount ?? pool.length));
    const distinctForWave = Math.max(1, hints.colorDistinctCount ?? pool.length);

    const centroidRaw =
      weights && weights.length >= 7
        ? centroidSemitoneFromWeights(weights, mask, scaleMode)
        : pool.reduce((a, b) => a + b, 0) / Math.max(1, pool.length);
    smoothCentroidSemi = smoothCentroidSemi * 0.92 + centroidRaw * 0.08;

    if (hints.plateMeanField != null) {
      smoothPlateMean =
        smoothPlateMean * 0.82 + Math.max(-1, Math.min(1, hints.plateMeanField)) * 0.18;
    }
    if (hints.plateRms != null) {
      smoothPlateRms =
        smoothPlateRms * 0.8 + Math.max(0, Math.min(1.2, hints.plateRms)) * 0.2;
    }
    if (hints.plateCoverage != null) {
      smoothPlateCov =
        smoothPlateCov * 0.78 + Math.max(0, Math.min(1, hints.plateCoverage)) * 0.22;
    }

    const now = performance.now();
    const dtSec = Math.min(0.055, Math.max(0, (now - lastDriveNow) / 1000));
    lastDriveNow = now;

    const presence = visualPresence(smoothMotion, smoothEnergy, smoothBright);
    const t = ctx.currentTime;

    const sym = Math.max(
      1,
      Math.min(12, Math.round(hints.symRotations ?? 1)),
    );
    const ink = Math.min(
      1,
      Math.max(
        0,
        (smoothBright - 0.02) * 5.2 +
          smoothEnergy * 0.42 +
          smoothMotion * 0.12,
      ),
    );
    const timeSec = now / 1000;
    waveListenAngle += 0.018 + smoothMotion * 0.014 + ink * 0.01;
    const u = 0.5 + 0.38 * Math.sin(waveListenAngle * 0.73);
    const v = 0.5 + 0.38 * Math.cos(waveListenAngle * 0.59 + 0.4);
    const swp: StandingWaveParams = {
      timeSec,
      centroidSemitone: smoothCentroidSemi,
      distinctCount: distinctForWave,
      symRotations: sym,
      inkStrength: ink,
    };
    const fListen = sampleStandingWaveField(u, v, swp);
    const fCenter = sampleStandingWaveField(0.5, 0.5, swp);
    const velListen = sampleStandingWaveVelocity(u, v, swp, 0.028);
    smoothWaveField = smoothWaveField * 0.82 + fListen * 0.18;
    smoothWaveVel =
      smoothWaveVel * 0.8 + Math.min(2.5, Math.abs(velListen)) * 0.2;

    /** Filtered noise: “fluid” agitation — stronger where strokes ride the mode */
    const plateFluid =
      0.42 +
      0.48 * smoothPlateRms +
      0.38 * smoothPlateCov +
      0.22 * Math.abs(smoothPlateMean);
    const fluidDrive =
      presence *
      (0.22 + 0.78 * ink) *
      (0.35 + 0.42 * Math.abs(smoothWaveField) + 0.5 * smoothWaveVel) *
      plateFluid;
    fluidGain.gain.setTargetAtTime(Math.min(0.055, 0.008 + fluidDrive * 0.052), t, 0.22);
    const lpHz = Math.min(
      820,
      280 +
        smoothBright * 260 +
        smoothWaveVel * 140 +
        Math.abs(fListen) * 90 +
        presence * 80 +
        smoothPlateRms * 55 +
        smoothPlateCov * 40,
    );
    fluidLp.frequency.setTargetAtTime(lpHz, t, 0.35);

    const activity = Math.min(
      1,
      0.3 * smoothMotion +
        0.28 * smoothBright +
        0.14 * smoothEnergy +
        0.05 * (k / 7) +
        0.12 * smoothPlateCov +
        0.1 * smoothPlateRms,
    );
    const stepMs = Math.max(
      380,
      1100 - activity * 260 - (k - 1) * 20 - smoothPlateRms * 70,
    );

    const melodyMode = hints.colorMelodyMode ?? DEFAULT_COLOR_MELODY_MODE;
    const tonicPc = tonicPitchClassFromAnalysis(mask, weights, scaleMode);

    if (melodyMode === "phrase") {
      if (now - lastNoteMs >= stepMs) {
        lastNoteMs = now;
        const phrase = getPhraseDegrees(phraseIndex);
        const phraseLen = phrase.length;
        const wasAtPhraseStart = noteInPhrase === 0;
        const phraseClosing = phraseLen > 0 && noteInPhrase >= phraseLen - 1;
        const deg = phrase[noteInPhrase] ?? 0;
        noteInPhrase++;
        if (noteInPhrase >= phrase.length) {
          noteInPhrase = 0;
          phraseIndex = (phraseIndex + 1) % getPhraseCount();
        }
        const phraseJustStarted = wasAtPhraseStart;

        const pl = pool.length;
        const poolIdx = pl > 0 ? deg % pl : 0;
        const melodyPc = ((((pool[poolIdx] ?? 0) % 12) + 12) % 12) as number;
        lastMelodyPc = melodyPc;

        const minHold = 2;
        const mustRepick =
          chordAgeNotes >= minHold || !triadContainsMelody(harmonyTriad, melodyPc);
        if (mustRepick) {
          const prev = harmonyTriad;
          harmonyTriad = pickDiatonicTriad({
            tonicPc,
            melodyPc,
            previous: prev,
            chordAgeNotes,
            minHoldNotes: minHold,
            phraseJustStarted,
            phraseClosing,
            scaleMode,
          });
          if (
            harmonyTriad.rootPc !== prev.rootPc ||
            harmonyTriad.roman !== prev.roman
          ) {
            chordAgeNotes = 0;
          }
        }
        chordAgeNotes++;

        let semi = pool[poolIdx] ?? 0;
        const frac = smoothCentroidSemi - Math.floor(smoothCentroidSemi);
        semi += frac * 0.08 + smoothPlateMean * 0.045;
        /** No octave up — keep phrase entirely in the deep register */
        const hz = ROOT_HZ * Math.pow(2, semi / 12);
        lastMelodyHz = hz;
        melodyOsc.frequency.setTargetAtTime(hz, t, 0.18);
      }
    } else {
      const melodyPc = ((Math.round(smoothCentroidSemi) % 12) + 12) % 12;
      lastMelodyPc = melodyPc;

      const minChordMs = 1320;
      const mustRepick =
        !triadContainsMelody(harmonyTriad, melodyPc) ||
        now - lastChordPickMs >= minChordMs;
      if (mustRepick) {
        const prev = harmonyTriad;
        harmonyTriad = pickDiatonicTriad({
          tonicPc,
          melodyPc,
          previous: prev,
          chordAgeNotes: Math.min(12, Math.floor((now - lastChordPickMs) / 200)),
          minHoldNotes: 2,
          phraseJustStarted: false,
          phraseClosing: false,
          scaleMode,
        });
        if (
          harmonyTriad.rootPc !== prev.rootPc ||
          harmonyTriad.roman !== prev.roman
        ) {
          chordAgeNotes = 0;
        }
        lastChordPickMs = now;
      }

      const semi =
        smoothCentroidSemi +
        smoothPlateMean * 0.055 +
        smoothWaveField * 0.035;
      lastMelodyHz = ROOT_HZ * Math.pow(2, semi / 12);
      melodyOsc.frequency.setTargetAtTime(lastMelodyHz, t, 0.42);
    }

    /** Flow: diatonic triad (sub, root, third) + smooth centroid lean; phase tracks chord root */
    const drift0 = 3 * Math.sin(now * 0.00022);
    const drift1 = 3.5 * Math.sin(now * 0.00027 + 1.1);
    const drift2 = 2.5 * Math.sin(now * 0.00024 + 2.2);
    const rootHz = hzFromPitchClass(harmonyTriad.rootPc);
    const thirdMul = Math.pow(
      2,
      triadThirdSemitonesFromRoot(harmonyTriad.quality) / 12,
    );
    lastFlowRootHz = rootHz;
    flowPhaseAccum +=
      2 *
        Math.PI *
        rootHz *
        dtSec *
        (1 + 0.13 * smoothWaveField + 0.09 * smoothPlateRms) +
      2 * Math.PI * lastMelodyHz * dtSec * 0.065;
    if (flowPhaseAccum > 12_000) {
      flowPhaseAccum -= Math.floor(flowPhaseAccum / (2 * Math.PI)) * 2 * Math.PI;
    }

    const centroidLean =
      (smoothCentroidSemi - harmonyTriad.rootPc) * 2.8 + smoothWaveField * 1.8;

    flowOsc0.frequency.setTargetAtTime(rootHz * 0.5, t, 0.55);
    flowOsc1.frequency.setTargetAtTime(rootHz, t, 0.5);
    flowOsc2.frequency.setTargetAtTime(rootHz * thirdMul, t, 0.48);
    const plateDetune = smoothPlateMean * 4.2 + smoothPlateRms * 2.8;
    flowOsc0.detune.setTargetAtTime(
      drift0 + smoothMotion * 4 + plateDetune * 0.35 + centroidLean * 0.2,
      t,
      0.25,
    );
    flowOsc1.detune.setTargetAtTime(
      drift1 - smoothBright * 3 + plateDetune * 0.55 + centroidLean * 0.25,
      t,
      0.25,
    );
    flowOsc2.detune.setTargetAtTime(
      drift2 + smoothEnergy * 3.5 + plateDetune * 0.4 + centroidLean * 0.18,
      t,
      0.25,
    );

    const flowBed = (0.28 + 0.72 * presence) * 0.95;
    const grayFlowBoost = hints.centerGraySalt ? 1.07 : 1;
    /** Standing-wave nodal/antinodal breathing + stroke–plate overlap */
    const plateGain = 1 + smoothPlateCov * 0.14 + smoothPlateRms * 0.11;
    const platePhase = 1 + smoothPlateMean * 0.1;
    const wMod = (0.86 + 0.22 * (0.5 + 0.5 * fCenter)) * platePhase;
    const wMod2 = (0.9 + 0.18 * (0.5 + 0.5 * smoothWaveField)) * plateGain;
    flowGain0.gain.setTargetAtTime(0.038 * flowBed * wMod, t, 0.18);
    flowGain1.gain.setTargetAtTime(0.032 * flowBed * grayFlowBoost * wMod2, t, 0.18);
    flowGain2.gain.setTargetAtTime(0.026 * flowBed * wMod * (0.97 + smoothPlateRms * 0.06), t, 0.18);

    const dTime =
      0.42 +
      smoothBright * 0.22 +
      Math.sin(now * 0.0001) * 0.05 +
      smoothWaveField * 0.055 +
      smoothPlateMean * 0.04;
    melodyDelay.delayTime.setTargetAtTime(
      Math.min(1.05, Math.max(0.18, dTime)),
      t,
      0.3,
    );
    melodyDelayFb.gain.setTargetAtTime(
      0.07 +
        smoothBright * 0.05 +
        smoothWaveVel * 0.028 +
        smoothPlateRms * 0.022,
      t,
      0.22,
    );
    melodyDelayWet.gain.setTargetAtTime(0.2 + smoothMotion * 0.06, t, 0.16);
    melodyDryGain.gain.setTargetAtTime(0.48 + smoothBright * 0.08, t, 0.14);

    const melodyAudible = 0.08 + 0.92 * Math.pow(presence, 0.9);
    const lead =
      (0.022 +
        smoothMotion * 0.014 +
        smoothBright * 0.008 +
        smoothPlateCov * 0.0065) *
      melodyAudible;
    melodyGain.gain.setTargetAtTime(Math.min(0.045, lead), t, 0.14);

    /** Ripple: next chord tone above lead (consonant with current triad) */
    const ripLead = Math.min(0.045, lead);
    const ripSemi = rippleSemitonesToNextChordTone(lastMelodyPc, harmonyTriad);
    melodyRippleOsc.frequency.setTargetAtTime(
      lastMelodyHz * Math.pow(2, ripSemi / 12),
      t,
      0.22,
    );
    melodyRippleGain.gain.setTargetAtTime(Math.min(0.014, ripLead * 0.34), t, 0.12);

    if (melodyMode === "blend") {
      const tops = topWeightedPitchClasses(weights, mask, 3, 0.052, scaleMode);
      const oscs = [comboOsc0, comboOsc1, comboOsc2] as const;
      const gains = [comboGain0, comboGain1, comboGain2] as const;
      for (let i = 0; i < 3; i++) {
        const o = oscs[i]!;
        const gn = gains[i]!;
        const ent = tops[i];
        o.frequency.setTargetAtTime(
          ent ? hzFromPitchClass(ent.pitchClass) : ROOT_HZ,
          t,
          0.35,
        );
        const wNorm = ent ? Math.min(1, ent.weight / 0.36) : 0;
        const cg = Math.min(0.021, 0.011 * wNorm * (0.28 + 0.72 * presence));
        gn.gain.setTargetAtTime(cg, t, 0.2);
      }
    } else {
      comboGain0.gain.setTargetAtTime(0, t, 0.12);
      comboGain1.gain.setTargetAtTime(0, t, 0.12);
      comboGain2.gain.setTargetAtTime(0, t, 0.12);
    }

    /** Underwater rolloff: no treble content */
    warmFilter.frequency.setTargetAtTime(
      520 + smoothBright * 380 + smoothMotion * 120 + smoothPlateRms * 28,
      t,
      0.35,
    );
  }

  function resumeIfNeeded(): void {
    if (!enabled || !ctx || ctx.state === "running") return;
    void ctx.resume();
  }

  function dispose(): void {
    enabled = false;
    for (const o of toStop) {
      try {
        o.stop();
      } catch {
        /* ignore */
      }
    }
    toStop.length = 0;
    flowOsc0 = null;
    flowGain0 = null;
    flowOsc1 = null;
    flowGain1 = null;
    flowOsc2 = null;
    flowGain2 = null;
    melodyOsc = null;
    melodyGain = null;
    melodyDryGain = null;
    melodyDelay = null;
    melodyDelayWet = null;
    melodyDelayFb = null;
    melodyRippleOsc = null;
    melodyRippleGain = null;
    comboOsc0 = null;
    comboGain0 = null;
    comboOsc1 = null;
    comboGain1 = null;
    comboOsc2 = null;
    comboGain2 = null;
    fluidNoiseSrc = null;
    fluidLp = null;
    fluidGain = null;
    warmFilter = null;
    master = null;
    compressor = null;
    if (ctx) {
      void ctx.close();
    }
    ctx = null;
    graphBuilt = false;
  }

  function isEnabled(): boolean {
    return enabled;
  }

  function getDriveState(): AmbientDriveState | null {
    if (!enabled || !graphBuilt) return null;
    const baseFlowHz = lastFlowRootHz;
    const ripple = Math.min(
      1,
      smoothWaveVel * 0.36 +
        smoothPlateRms * 0.44 +
        Math.abs(smoothWaveField) * 0.22,
    );
    return {
      melodyHz: lastMelodyHz,
      flowPhase: flowPhaseAccum,
      ripple,
      baseFlowHz,
    };
  }

  return { setEnabled, isEnabled, update, getDriveState, resumeIfNeeded, dispose };
}
