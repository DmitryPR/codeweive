/**
 * Offline approximations of the in-app ambient (see src/ambient-sound.ts):
 * deep drifting triad ~65 Hz, optional phrase motion, brown-noise “fluid”.
 * Not a bit-accurate capture of the Web Audio graph — for quick A/B listening only.
 *
 * Requires devDependency `ffmpeg-static` (bundled ffmpeg with libmp3lame).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio", "ambient-demos");

const SR = 44100;
const DURATION_S = 28;

/** C2 root from ambient-sound.ts */
const ROOT_HZ = 65.41;

function hzFromSemitones(root, semi) {
  return root * 2 ** (semi / 12);
}

function floatTo16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return out;
}

function normalizePeak(floats, peak = 0.92) {
  let m = 0;
  for (let i = 0; i < floats.length; i++) {
    const a = Math.abs(floats[i]);
    if (a > m) m = a;
  }
  if (m < 1e-8) return floats;
  const g = peak / m;
  const out = new Float32Array(floats.length);
  for (let i = 0; i < floats.length; i++) out[i] = floats[i] * g;
  return out;
}

function encodePcmToMp3(pcmS16le, outFile) {
  const wavPath = `${outFile}.tmp.wav`;
  writeWavFile(wavPath, pcmS16le);
  const r = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      wavPath,
      "-c:a",
      "libmp3lame",
      "-q:a",
      "2",
      outFile,
    ],
    { encoding: "utf8" },
  );
  unlinkSync(wavPath);
  if (r.status !== 0) {
    throw new Error(r.stderr || `ffmpeg exited ${r.status}`);
  }
}

function writeWavFile(path, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2);
  }
  writeFileSync(path, buf);
}

function renderTriadDrift() {
  const n = Math.floor(SR * DURATION_S);
  const out = new Float32Array(n);
  const f0 = ROOT_HZ;
  const f1 = hzFromSemitones(ROOT_HZ, 3);
  const f2 = hzFromSemitones(ROOT_HZ, 7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const w0 = 0.14 + 0.1 * Math.sin(2 * Math.PI * 0.055 * t);
    const w1 = 0.12 + 0.09 * Math.sin(2 * Math.PI * 0.062 * t + 1.7);
    const w2 = 0.1 + 0.08 * Math.sin(2 * Math.PI * 0.048 * t + 3.1);
    const d0 = 1 + 0.004 * Math.sin(2 * Math.PI * 0.11 * t);
    const d1 = 1 + 0.005 * Math.sin(2 * Math.PI * 0.13 * t + 0.8);
    const d2 = 1 + 0.0035 * Math.sin(2 * Math.PI * 0.09 * t + 2.2);
    let s = 0;
    s += w0 * Math.sin(2 * Math.PI * f0 * d0 * t);
    s += w1 * Math.sin(2 * Math.PI * f1 * d1 * t + 0.4);
    s += w2 * Math.sin(2 * Math.PI * f2 * d2 * t + 1.1);
    out[i] = s * 0.45;
  }
  return normalizePeak(out);
}

function renderPhraseAndDelay() {
  const n = Math.floor(SR * DURATION_S);
  const out = new Float32Array(n);
  const phraseSemi = [0, 3, 7, 12, 7, 3, 5, 0];
  const stepS = 1.35;
  const delaySamples = Math.round(0.42 * SR);
  const dry = new Float32Array(n);
  const f0 = ROOT_HZ;
  const f1 = hzFromSemitones(ROOT_HZ, 3);
  const f2 = hzFromSemitones(ROOT_HZ, 7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const step = Math.floor(t / stepS) % phraseSemi.length;
    const lead = hzFromSemitones(ROOT_HZ, phraseSemi[step]);
    const glide = 0.02 * Math.sin(2 * Math.PI * 2.2 * t);
    const wTri = 0.1 + 0.06 * Math.sin(2 * Math.PI * 0.05 * t);
    let s = 0;
    s += wTri * 0.35 * Math.sin(2 * Math.PI * f0 * t);
    s += wTri * 0.32 * Math.sin(2 * Math.PI * f1 * t + 0.5);
    s += wTri * 0.28 * Math.sin(2 * Math.PI * f2 * t + 1.0);
    s += 0.14 * Math.sin(2 * Math.PI * lead * (1 + glide) * t + 2.2);
    dry[i] = s;
  }
  for (let i = 0; i < n; i++) {
    const wet = i >= delaySamples ? dry[i - delaySamples] * 0.42 : 0;
    const wet2 = i >= delaySamples * 2 ? dry[i - delaySamples * 2] * 0.22 : 0;
    out[i] = dry[i] * 0.72 + wet + wet2;
  }
  return normalizePeak(out);
}

function renderFluidBed() {
  const n = Math.floor(SR * DURATION_S);
  const out = new Float32Array(n);
  let brown = 0;
  let lp = 0;
  const f0 = ROOT_HZ;
  const f1 = hzFromSemitones(ROOT_HZ, 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    brown += (Math.random() * 2 - 1) * 0.045;
    brown *= 0.9985;
    lp = lp * 0.985 + brown * 0.015;
    const chop = 0.08 + 0.06 * Math.sin(2 * Math.PI * 0.31 * t) * Math.sin(2 * Math.PI * 0.07 * t);
    const fluid = lp * chop;
    const sub =
      0.1 * Math.sin(2 * Math.PI * f0 * t) + 0.07 * Math.sin(2 * Math.PI * f1 * t + 0.6);
    out[i] = fluid * 0.55 + sub * 0.35;
  }
  return normalizePeak(out);
}

if (!ffmpegPath) {
  console.error("ffmpeg-static: binary path missing (re-run npm install).");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const variants = [
  { name: "ambient-demo-01-triad-drift.mp3", render: renderTriadDrift },
  { name: "ambient-demo-02-phrase-delay.mp3", render: renderPhraseAndDelay },
  { name: "ambient-demo-03-fluid-bed.mp3", render: renderFluidBed },
];

for (const { name, render } of variants) {
  const pcm = floatTo16(normalizePeak(render()));
  const path = join(OUT_DIR, name);
  encodePcmToMp3(pcm, path);
  console.log(`Wrote ${path}`);
}
