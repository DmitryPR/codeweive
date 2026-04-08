# RECIPIE — mandala-like geometry vs. Silk (codeweive)

Educational note: **“recipie”** is intentional wordplay here (recipe book). For implementation details of the port, see [`ALGORITHM.md`](ALGORITHM.md) and [`../src/silk.ts`](../src/silk.ts).

---

## 1. Current Silk in this repo (codeweive)

**What it is:** A **discrete chain** of points (your gesture) is updated each step with **damping**, **multi-octave noise** as a direction field, **neighbor “spring”** pulls, and optional **wind**. The same polyline is then drawn many times under **rotations** (by `2π/n` radians per sector), optional **mirror**, and **spiral** scaling — then stroked with quadratic mids and **`lighter`** compositing.

**Why it can look like a mandala:** You get **n-fold rotational symmetry** (and **dihedral** symmetry with mirror) from **group orbit** of one organic stroke, not from a single polar equation.

**Schematic (conceptual):** one stroke (highlight) and four dim copies at 72° (5-fold) — not an exact screenshot of the engine.

### Silk-style symmetry (schematic)

*Orbit of one curve under rotation; mirror/spiral add more arms.*

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="Silk-style symmetry (schematic)">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(0)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(72)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(144)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(216)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#6b5a8c" stroke-width="2" opacity="0.35" transform="rotate(288)"/>
  <path d="M 0,0 Q 45,-85 100,-25" stroke="#c9a8e8" stroke-width="2.5" transform="rotate(0)"/>
  </g>
</svg>



---

## 2. Polar rose (rhodonea)

**Idea:** One closed curve from polar radius `r = cos(nθ)` (or sin) in the plane → **n petals** if n is odd, **2n petals** if n is even (standard polar-rose caveat).

**Contrast with Silk:** Pure **analytic** curve; no particle chain, no noise.

### Rose (n = 5)

\(r = \cos(5\theta)\) in the plane: \(x = r\cos\theta,\; y = r\sin\theta\).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="Rose (n = 5)">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <path d="M 190.0,0.0 L 184.1,9.0 L 166.8,16.4 L 139.3,20.7 L 103.5,20.6 L 62.1,15.6 L 17.8,5.4 L -26.2,-9.4 L -67.2,-27.8 L -102.3,-48.4 L -129.5,-69.2 L -147.3,-88.3 L -154.9,-103.5 L -152.4,-113.0 L -140.5,-115.3 L -120.8,-109.4 L -95.0,-95.0 L -65.6,-72.4 L -35.0,-42.6 L -5.6,-7.5 L 20.6,30.8 L 41.8,69.7 L 56.8,106.3 L 65.2,138.0 L 67.2,162.2 L 63.3,177.0 L 54.9,180.9 L 43.5,173.5 L 30.8,154.9 L 18.7,126.2 L 8.8,89.1 L 2.3,46.1 L 0.0,0.0 L 2.3,-46.1 L 8.8,-89.1 L 18.7,-126.2 L 30.8,-154.9 L 43.5,-173.5 L 54.9,-180.9 L 63.3,-177.0 L 67.2,-162.2 L 65.2,-138.0 L 56.8,-106.3 L 41.8,-69.7 L 20.6,-30.8 L -5.6,7.5 L -35.0,42.6 L -65.6,72.4 L -95.0,95.0 L -120.8,109.4 L -140.5,115.3 L -152.4,113.0 L -154.9,103.5 L -147.3,88.3 L -129.5,69.2 L -102.3,48.4 L -67.2,27.8 L -26.2,9.4 L 17.8,-5.4 L 62.1,-15.6 L 103.5,-20.6 L 139.3,-20.7 L 166.8,-16.4 L 184.1,-9.0 L 190.0,-0.0 L 184.1,9.0 L 166.8,16.4 L 139.3,20.7 L 103.5,20.6 L 62.1,15.6 L 17.8,5.4 L -26.2,-9.4 L -67.2,-27.8 L -102.3,-48.4 L -129.5,-69.2 L -147.3,-88.3 L -154.9,-103.5 L -152.4,-113.0 L -140.5,-115.3 L -120.8,-109.4 L -95.0,-95.0 L -65.6,-72.4 L -35.0,-42.6 L -5.6,-7.5 L 20.6,30.8 L 41.8,69.7 L 56.8,106.3 L 65.2,138.0 L 67.2,162.2 L 63.3,177.0 L 54.9,180.9 L 43.5,173.5 L 30.8,154.9 L 18.7,126.2 L 8.8,89.1 L 2.3,46.1 L 0.0,0.0 L 2.3,-46.1 L 8.8,-89.1 L 18.7,-126.2 L 30.8,-154.9 L 43.5,-173.5 L 54.9,-180.9 L 63.3,-177.0 L 67.2,-162.2 L 65.2,-138.0 L 56.8,-106.3 L 41.8,-69.7 L 20.6,-30.8 L -5.6,7.5 L -35.0,42.6 L -65.6,72.4 L -95.0,95.0 L -120.8,109.4 L -140.5,115.3 L -152.4,113.0 L -154.9,103.5 L -147.3,88.3 L -129.5,69.2 L -102.3,48.4 L -67.2,27.8 L -26.2,9.4 L 17.8,-5.4 L 62.1,-15.6 L 103.5,-20.6 L 139.3,-20.7 L 166.8,-16.4 L 184.1,-9.0 L 190.0,-0.0" fill="none" stroke="#7eb8da" stroke-width="2" stroke-linejoin="round"/>
</svg>



---

## 3. Hypotrochoid / “spirograph”

**Idea:** A point attached to a **small wheel** rolling **inside** a fixed circle traces a **roulette**. Closed lobes when parameters are rational.

**Contrast with Silk:** **Kinematic** construction (rolling circles), not noise-driven filaments.

### Hypotrochoid sample

Fixed \(R\), rolling \(r\), pen at distance \(d\): standard parametric roulette (here \(R:r:d = 5:2:3\), scaled).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="Hypotrochoid sample">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <path d="M 228.0,0.0 L 226.9,-4.5 L 223.4,-8.8 L 217.8,-12.8 L 210.0,-16.5 L 200.1,-19.7 L 188.3,-22.3 L 174.6,-24.1 L 159.2,-25.2 L 142.4,-25.4 L 124.2,-24.7 L 105.0,-23.0 L 84.8,-20.4 L 64.0,-16.7 L 42.8,-12.1 L 21.4,-6.5 L 0.0,-0.0 L -21.1,7.3 L -41.7,15.4 L -61.6,24.1 L -80.6,33.4 L -98.5,43.1 L -115.0,53.0 L -130.1,63.1 L -143.6,73.2 L -155.4,83.1 L -165.4,92.6 L -173.5,101.7 L -179.6,110.1 L -183.8,117.6 L -185.9,124.2 L -186.2,129.7 L -184.5,134.0 L -180.9,136.9 L -175.6,138.4 L -168.7,138.4 L -160.2,136.8 L -150.3,133.6 L -139.2,128.7 L -127.0,122.2 L -114.0,114.0 L -100.2,104.3 L -86.0,93.0 L -71.4,80.3 L -56.7,66.3 L -42.0,51.2 L -27.5,34.9 L -13.5,17.8 L -0.0,0.0 L 12.8,-18.3 L 24.7,-37.0 L 35.7,-55.7 L 45.6,-74.4 L 54.3,-92.7 L 61.9,-110.5 L 68.2,-127.6 L 73.2,-143.6 L 76.9,-158.6 L 79.4,-172.2 L 80.6,-184.2 L 80.6,-194.6 L 79.5,-203.2 L 77.4,-209.8 L 74.3,-214.4 L 70.5,-216.8 L 65.9,-217.1 L 60.7,-215.2 L 55.1,-211.1 L 49.2,-204.8 L 43.1,-196.4 L 37.0,-185.9 L 31.0,-173.5 L 25.2,-159.2 L 19.8,-143.3 L 14.9,-125.8 L 10.5,-107.0 L 6.8,-87.0 L 3.9,-66.1 L 1.7,-44.4 L 0.4,-22.3 L 0.0,-0.0 L 0.4,22.3 L 1.7,44.4 L 3.9,66.1 L 6.8,87.0 L 10.5,107.0 L 14.9,125.8 L 19.8,143.3 L 25.2,159.2 L 31.0,173.5 L 37.0,185.9 L 43.1,196.4 L 49.2,204.8 L 55.1,211.1 L 60.7,215.2 L 65.9,217.1 L 70.5,216.8 L 74.3,214.4 L 77.4,209.8 L 79.5,203.2 L 80.6,194.6 L 80.6,184.2 L 79.4,172.2 L 76.9,158.6 L 73.2,143.6 L 68.2,127.6 L 61.9,110.5 L 54.3,92.7 L 45.6,74.4 L 35.7,55.7 L 24.7,37.0 L 12.8,18.3 L -0.0,-0.0 L -13.5,-17.8 L -27.5,-34.9 L -42.0,-51.2 L -56.7,-66.3 L -71.4,-80.3 L -86.0,-93.0 L -100.2,-104.3 L -114.0,-114.0 L -127.0,-122.2 L -139.2,-128.7 L -150.3,-133.6 L -160.2,-136.8 L -168.7,-138.4 L -175.6,-138.4 L -180.9,-136.9 L -184.5,-134.0 L -186.2,-129.7 L -185.9,-124.2 L -183.8,-117.6 L -179.6,-110.1 L -173.5,-101.7 L -165.4,-92.6 L -155.4,-83.1 L -143.6,-73.2 L -130.1,-63.1 L -115.0,-53.0 L -98.5,-43.1 L -80.6,-33.4 L -61.6,-24.1 L -41.7,-15.4 L -21.1,-7.3 L -0.0,-0.0 L 21.4,6.5 L 42.8,12.1 L 64.0,16.7 L 84.8,20.4 L 105.0,23.0 L 124.2,24.7 L 142.4,25.4 L 159.2,25.2 L 174.6,24.1 L 188.3,22.3 L 200.1,19.7 L 210.0,16.5 L 217.8,12.8 L 223.4,8.8 L 226.9,4.5 L 228.0,0.0 L 226.9,-4.5 L 223.4,-8.8 L 217.8,-12.8 L 210.0,-16.5 L 200.1,-19.7 L 188.3,-22.3 L 174.6,-24.1 L 159.2,-25.2 L 142.4,-25.4 L 124.2,-24.7 L 105.0,-23.0 L 84.8,-20.4 L 64.0,-16.7 L 42.8,-12.1 L 21.4,-6.5 L 0.0,-0.0 L -21.1,7.3 L -41.7,15.4 L -61.6,24.1 L -80.6,33.4 L -98.5,43.1 L -115.0,53.0 L -130.1,63.1 L -143.6,73.2 L -155.4,83.1 L -165.4,92.6 L -173.5,101.7 L -179.6,110.1 L -183.8,117.6 L -185.9,124.2 L -186.2,129.7 L -184.5,134.0 L -180.9,136.9 L -175.6,138.4 L -168.7,138.4 L -160.2,136.8 L -150.3,133.6 L -139.2,128.7 L -127.0,122.2 L -114.0,114.0" fill="none" stroke="#9dd6a7" stroke-width="2" stroke-linejoin="round"/>
</svg>



---

## 4. Lissajous figure

**Idea:** \((x,y) = (A\sin(at+\phi), B\sin(bt))\). **Rational** \(a/b\) gives a **closed** knot-like curve; irrational fills a region densely.

**Contrast with Silk:** **Harmonic** superposition, not a dragged spring–noise integrator.

### Lissajous (3 : 4)

\(x = \sin(3t+\pi/4),\; y = \sin(4t)\).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="Lissajous (3 : 4)">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <path d="M 130.8,0.0 L 148.6,36.1 L 163.2,70.8 L 174.2,102.8 L 181.4,130.8 L 184.8,153.8 L 184.1,170.9 L 179.5,181.4 L 170.9,185.0 L 158.7,181.4 L 143.0,170.9 L 124.2,153.8 L 102.8,130.8 L 79.1,102.8 L 53.7,70.8 L 27.1,36.1 L 0.0,0.0 L -27.1,-36.1 L -53.7,-70.8 L -79.1,-102.8 L -102.8,-130.8 L -124.2,-153.8 L -143.0,-170.9 L -158.7,-181.4 L -170.9,-185.0 L -179.5,-181.4 L -184.1,-170.9 L -184.8,-153.8 L -181.4,-130.8 L -174.2,-102.8 L -163.2,-70.8 L -148.6,-36.1 L -130.8,-0.0 L -110.2,36.1 L -87.2,70.8 L -62.3,102.8 L -36.1,130.8 L -9.1,153.8 L 18.1,170.9 L 45.0,181.4 L 70.8,185.0 L 95.1,181.4 L 117.4,170.9 L 137.1,153.8 L 153.8,130.8 L 167.2,102.8 L 177.0,70.8 L 183.0,36.1 L 185.0,0.0 L 183.0,-36.1 L 177.0,-70.8 L 167.2,-102.8 L 153.8,-130.8 L 137.1,-153.8 L 117.4,-170.9 L 95.1,-181.4 L 70.8,-185.0 L 45.0,-181.4 L 18.1,-170.9 L -9.1,-153.8 L -36.1,-130.8 L -62.3,-102.8 L -87.2,-70.8 L -110.2,-36.1 L -130.8,-0.0 L -148.6,36.1 L -163.2,70.8 L -174.2,102.8 L -181.4,130.8 L -184.8,153.8 L -184.1,170.9 L -179.5,181.4 L -170.9,185.0 L -158.7,181.4 L -143.0,170.9 L -124.2,153.8 L -102.8,130.8 L -79.1,102.8 L -53.7,70.8 L -27.1,36.1 L -0.0,0.0 L 27.1,-36.1 L 53.7,-70.8 L 79.1,-102.8 L 102.8,-130.8 L 124.2,-153.8 L 143.0,-170.9 L 158.7,-181.4 L 170.9,-185.0 L 179.5,-181.4 L 184.1,-170.9 L 184.8,-153.8 L 181.4,-130.8 L 174.2,-102.8 L 163.2,-70.8 L 148.6,-36.1 L 130.8,-0.0 L 110.2,36.1 L 87.2,70.8 L 62.3,102.8 L 36.1,130.8 L 9.1,153.8 L -18.1,170.9 L -45.0,181.4 L -70.8,185.0 L -95.1,181.4 L -117.4,170.9 L -137.1,153.8 L -153.8,130.8 L -167.2,102.8 L -177.0,70.8 L -183.0,36.1 L -185.0,0.0 L -183.0,-36.1 L -177.0,-70.8 L -167.2,-102.8 L -153.8,-130.8 L -137.1,-153.8 L -117.4,-170.9 L -95.1,-181.4 L -70.8,-185.0 L -45.0,-181.4 L -18.1,-170.9 L 9.1,-153.8 L 36.1,-130.8 L 62.3,-102.8 L 87.2,-70.8 L 110.2,-36.1 L 130.8,-0.0" fill="none" stroke="#e8b86d" stroke-width="2" stroke-linejoin="round"/>
</svg>



---

## 5. Epicycle (low-order Fourier rosette)

**Idea:** \(\gamma(t) = \sum_k r_k e^{i(n_k t + \phi_k)}\) — a few **rotating phasors** sum to a smooth **closed** boundary (related to **Fourier** description of curves).

**Contrast with Silk:** **Global** parametrization; Silk’s path is **history-dependent** simulation.

### 3-term epicycle curve

\(\sum_{k=1}^{3} r_k \big(\cos(kt+\phi_k), \sin(kt+\phi_k)\big)\) with small \(r_k\).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="3-term epicycle curve">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <path d="M 160.5,76.6 L 150.7,87.6 L 140.0,97.3 L 128.7,105.7 L 116.9,112.7 L 104.7,118.2 L 92.4,122.4 L 80.2,125.2 L 68.1,126.6 L 56.4,126.8 L 45.2,125.8 L 34.6,123.7 L 24.7,120.6 L 15.6,116.7 L 7.5,112.0 L 0.3,106.8 L -5.9,101.2 L -11.1,95.3 L -15.4,89.2 L -18.6,83.2 L -21.0,77.3 L -22.5,71.6 L -23.2,66.3 L -23.2,61.5 L -22.6,57.1 L -21.6,53.4 L -20.2,50.3 L -18.5,47.8 L -16.7,46.0 L -14.8,44.9 L -13.1,44.3 L -11.5,44.4 L -10.2,45.0 L -9.2,46.0 L -8.7,47.4 L -8.6,49.1 L -9.0,51.0 L -9.9,53.0 L -11.4,55.0 L -13.3,56.9 L -15.8,58.7 L -18.7,60.2 L -21.9,61.4 L -25.6,62.2 L -29.5,62.6 L -33.6,62.5 L -37.8,61.9 L -42.1,60.8 L -46.3,59.1 L -50.3,57.0 L -54.2,54.4 L -57.8,51.4 L -61.0,47.9 L -63.9,44.2 L -66.3,40.2 L -68.2,36.0 L -69.7,31.8 L -70.7,27.5 L -71.1,23.2 L -71.2,19.1 L -70.8,15.2 L -70.1,11.6 L -69.0,8.3 L -67.7,5.3 L -66.2,2.8 L -64.7,0.6 L -63.1,-1.1 L -61.6,-2.4 L -60.2,-3.3 L -59.0,-3.8 L -58.2,-4.1 L -57.7,-4.1 L -57.6,-3.9 L -58.0,-3.6 L -58.8,-3.3 L -60.1,-3.2 L -61.9,-3.2 L -64.2,-3.4 L -66.9,-4.1 L -70.0,-5.2 L -73.4,-6.9 L -77.1,-9.3 L -80.9,-12.3 L -84.7,-16.0 L -88.4,-20.6 L -92.0,-25.9 L -95.2,-32.0 L -97.9,-39.0 L -100.1,-46.6 L -101.6,-55.0 L -102.3,-63.9 L -102.0,-73.4 L -100.7,-83.3 L -98.4,-93.5 L -94.8,-103.8 L -90.0,-114.1 L -84.0,-124.3 L -76.8,-134.2 L -68.2,-143.6 L -58.5,-152.4 L -47.7,-160.4 L -35.8,-167.4 L -22.9,-173.3 L -9.2,-178.1 L 5.3,-181.4 L 20.2,-183.4 L 35.6,-183.9 L 51.2,-182.7 L 66.8,-180.0 L 82.2,-175.7 L 97.3,-169.8 L 111.8,-162.3 L 125.6,-153.4 L 138.6,-143.0 L 150.4,-131.3 L 161.1,-118.5 L 170.4,-104.6 L 178.3,-89.9 L 184.6,-74.5 L 189.3,-58.5 L 192.4,-42.3 L 193.8,-25.9 L 193.6,-9.6 L 191.7,6.4 L 188.2,22.0 L 183.3,37.0 L 176.9,51.2 L 169.3,64.4 L 160.5,76.6" fill="none" stroke="#d88cba" stroke-width="2" stroke-linejoin="round"/>
</svg>



---

## 6. Logarithmic spiral arm (similarity symmetry)

**Idea:** \(r = a e^{b\theta}\) — **self-similar** under combined **rotation and scaling**. Mandala *feeling* often comes from **spiral arms** plus **sectors** (Silk’s **spiral copies** echo this visually).

**Contrast with Silk:** Single **analytic** spiral; Silk stacks **many scaled rotated** draw passes of the **same** stroke.

### Logarithmic spiral (segment)

\(r \propto e^{\beta\theta}\) (finite segment sampled).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="320" height="320" role="img" aria-label="Logarithmic spiral (segment)">
  <rect x="-210" y="-210" width="420" height="420" fill="#0d0c12"/>
  <circle cx="0" cy="0" r="198" fill="none" stroke="#2a2638" stroke-width="1"/>
  <path d="M 6.9,0.0 L 6.9,1.0 L 6.8,2.1 L 6.5,3.1 L 6.0,4.1 L 5.4,5.0 L 4.6,5.8 L 3.8,6.5 L 2.8,7.1 L 1.7,7.6 L 0.6,7.8 L -0.6,7.9 L -1.8,7.8 L -3.0,7.6 L -4.2,7.1 L -5.2,6.5 L -6.2,5.7 L -7.1,4.8 L -7.8,3.7 L -8.4,2.5 L -8.8,1.3 L -9.0,-0.1 L -9.0,-1.4 L -8.8,-2.8 L -8.4,-4.1 L -7.8,-5.4 L -7.0,-6.6 L -6.0,-7.7 L -4.8,-8.6 L -3.5,-9.3 L -2.1,-9.9 L -0.6,-10.2 L 0.9,-10.3 L 2.5,-10.2 L 4.0,-9.9 L 5.5,-9.3 L 6.9,-8.4 L 8.2,-7.4 L 9.3,-6.2 L 10.3,-4.8 L 11.0,-3.2 L 11.5,-1.5 L 11.8,0.2 L 11.8,2.0 L 11.5,3.8 L 10.9,5.5 L 10.1,7.2 L 9.0,8.7 L 7.7,10.1 L 6.2,11.3 L 4.5,12.2 L 2.7,12.9 L 0.7,13.4 L -1.3,13.5 L -3.3,13.3 L -5.4,12.8 L -7.3,12.0 L -9.2,11.0 L -10.8,9.6 L -12.3,8.0 L -13.5,6.1 L -14.5,4.1 L -15.1,1.9 L -15.4,-0.4 L -15.4,-2.7 L -15.0,-5.0 L -14.2,-7.3 L -13.1,-9.5 L -11.7,-11.5 L -10.0,-13.3 L -8.0,-14.8 L -5.8,-16.1 L -3.4,-17.0 L -0.8,-17.5 L 1.8,-17.6 L 4.5,-17.4 L 7.2,-16.7 L 9.7,-15.7 L 12.1,-14.2 L 14.2,-12.4 L 16.1,-10.3 L 17.7,-7.8 L 18.9,-5.2 L 19.7,-2.3 L 20.1,0.7 L 20.1,3.7 L 19.5,6.8 L 18.5,9.7 L 17.1,12.5 L 15.2,15.1 L 12.9,17.5 L 10.3,19.5 L 7.4,21.0 L 4.2,22.2 L 0.8,22.9 L -2.6,23.0 L -6.1,22.7 L -9.5,21.8 L -12.8,20.4 L -15.9,18.4 L -18.8,16.1" fill="none" stroke="#88d4d4" stroke-width="2" stroke-linejoin="round"/>
</svg>



---

## Regenerate figures

From repo root:

```bash
node scripts/generate-recipie-md.mjs
```

This overwrites `docs/RECIPIE.md` with fresh SVG path data.
