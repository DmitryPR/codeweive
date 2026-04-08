#!/usr/bin/env node
/**
 * Regenerates docs/RECIPIE.md SVG path samples (run from repo root: node scripts/generate-recipie-md.mjs).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function toPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }
  return d;
}

function polarRose(n, scale, steps = 128) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = Math.cos(n * t);
    pts.push([r * Math.cos(t) * scale, r * Math.sin(t) * scale]);
  }
  return pts;
}

function lissajous(a, b, scale, steps = 128) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push([
      Math.sin(a * t + Math.PI / 4) * scale,
      Math.sin(b * t) * scale,
    ]);
  }
  return pts;
}

function hypo(R, r, d, scale, steps = 200) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * 2.5;
    const k = R - r;
    pts.push([
      (k * Math.cos(t) + d * Math.cos((k / r) * t)) * scale,
      (k * Math.sin(t) - d * Math.sin((k / r) * t)) * scale,
    ]);
  }
  return pts;
}

function logSpiral(scale = 1, steps = 100) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * 0.15;
    const r = 6 * Math.exp(0.085 * t) * scale;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/** 3-term epicycle: sum_k r_k cos(k t + phi), same for sin — closed-ish rosette */
function epicycle(scale, steps = 128) {
  const pts = [];
  const r = [0.45, 0.28, 0.18];
  const phi = [0, 0.7, 1.2];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    let x = 0;
    let y = 0;
    for (let k = 0; k < 3; k++) {
      const n = k + 1;
      x += r[k] * Math.cos(n * t + phi[k]);
      y += r[k] * Math.sin(n * t + phi[k]);
    }
    pts.push([x * scale, y * scale]);
  }
  return pts;
}

function svgCard(title, formula, bodyHtml, note) {
  return `### ${title}

${formula}

${note ? `${note}\n\n` : ""}<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="${title}">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  ${bodyHtml}
</svg>

`;
}

const rosePath = toPath(polarRose(5, 190));
const lissPath = toPath(lissajous(3, 4, 185));
const hypoPath = toPath(hypo(5, 2, 3, 38));
const spirPath = toPath(logSpiral(1.15));
const epicPath = toPath(epicycle(220));

const md = `# RECIPIE — mandala-like geometry vs. Silk (codeweive)

Educational note: **“recipie”** is intentional wordplay here (recipe book). For implementation details of the port, see [\`ALGORITHM.md\`](ALGORITHM.md) and [\`../src/silk.ts\`](../src/silk.ts).

---

## 1. Current Silk in this repo (codeweive)

**What it is:** A **discrete chain** of points (your gesture) is updated each step with **damping**, **multi-octave noise** as a direction field, **neighbor “spring”** pulls, and optional **wind**. The same polyline is then drawn many times under **rotations** (by \`2π/n\` radians per sector), optional **mirror**, and **spiral** scaling — then stroked with quadratic mids and **\`lighter\`** compositing.

**Why it can look like a mandala:** You get **n-fold rotational symmetry** (and **dihedral** symmetry with mirror) from **group orbit** of one organic stroke, not from a single polar equation.

**Schematic (conceptual):** one stroke (highlight) and four dim copies at 72° (5-fold) — not an exact screenshot of the engine.

${svgCard(
  "Silk-style symmetry (schematic)",
  "*Orbit of one curve under rotation; mirror/spiral add more arms.*",
  `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(0)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(72)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(144)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(216)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(288)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#c9a8e8" stroke-width="2.5" transform="rotate(0)"/>
  </g>`,
  "",
)}

---

## 2. Polar rose (rhodonea)

**Idea:** One closed curve from polar radius \`r = cos(nθ)\` (or sin) in the plane → **n petals** if n is odd, **2n petals** if n is even (standard polar-rose caveat).

**Contrast with Silk:** Pure **analytic** curve; no particle chain, no noise.

${svgCard(
  "Rose (n = 5)",
  "\\(r = \\cos(5\\theta)\\) in the plane: \\(x = r\\cos\\theta,\\; y = r\\sin\\theta\\).",
  `<path d="${rosePath}" fill="none" stroke="#7eb8da" stroke-width="2" stroke-linejoin="round"/>`,
  "",
)}

---

## 3. Hypotrochoid / “spirograph”

**Idea:** A point attached to a **small wheel** rolling **inside** a fixed circle traces a **roulette**. Closed lobes when parameters are rational.

**Contrast with Silk:** **Kinematic** construction (rolling circles), not noise-driven filaments.

${svgCard(
  "Hypotrochoid sample",
  "Fixed \\(R\\), rolling \\(r\\), pen at distance \\(d\\): standard parametric roulette (here \\(R:r:d = 5:2:3\\), scaled).",
  `<path d="${hypoPath}" fill="none" stroke="#9dd6a7" stroke-width="2" stroke-linejoin="round"/>`,
  "",
)}

---

## 4. Lissajous figure

**Idea:** \\((x,y) = (A\\sin(at+\\phi), B\\sin(bt))\\). **Rational** \\(a/b\\) gives a **closed** knot-like curve; irrational fills a region densely.

**Contrast with Silk:** **Harmonic** superposition, not a dragged spring–noise integrator.

${svgCard(
  "Lissajous (3 : 4)",
  "\\(x = \\sin(3t+\\pi/4),\\; y = \\sin(4t)\\).",
  `<path d="${lissPath}" fill="none" stroke="#e8b86d" stroke-width="2" stroke-linejoin="round"/>`,
  "",
)}

---

## 5. Epicycle (low-order Fourier rosette)

**Idea:** \\(\\gamma(t) = \\sum_k r_k e^{i(n_k t + \\phi_k)}\\) — a few **rotating phasors** sum to a smooth **closed** boundary (related to **Fourier** description of curves).

**Contrast with Silk:** **Global** parametrization; Silk’s path is **history-dependent** simulation.

${svgCard(
  "3-term epicycle curve",
  "\\(\\sum_{k=1}^{3} r_k \\big(\\cos(kt+\\phi_k), \\sin(kt+\\phi_k)\\big)\\) with small \\(r_k\\).",
  `<path d="${epicPath}" fill="none" stroke="#d88cba" stroke-width="2" stroke-linejoin="round"/>`,
  "",
)}

---

## 6. Logarithmic spiral arm (similarity symmetry)

**Idea:** \\(r = a e^{b\\theta}\\) — **self-similar** under combined **rotation and scaling**. Mandala *feeling* often comes from **spiral arms** plus **sectors** (Silk’s **spiral copies** echo this visually).

**Contrast with Silk:** Single **analytic** spiral; Silk stacks **many scaled rotated** draw passes of the **same** stroke.

${svgCard(
  "Logarithmic spiral (segment)",
  "\\(r \\propto e^{\\beta\\theta}\\) (finite segment sampled).",
  `<path d="${spirPath}" fill="none" stroke="#88d4d4" stroke-width="2" stroke-linejoin="round"/>`,
  "",
)}

---

## Regenerate figures

From repo root:

\`\`\`bash
node scripts/generate-recipie-md.mjs
\`\`\`

This overwrites \`docs/RECIPIE.md\` with fresh SVG path data.
`;

writeFileSync(join(root, "docs", "RECIPIE.md"), md, "utf8");
console.log("Wrote docs/RECIPIE.md");
