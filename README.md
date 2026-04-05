# codeweive

**Unofficial** educational port of **Silk — Interactive Generative Art** (the original lives at [http://weavesilk.com](http://weavesilk.com)) to **TypeScript** with **Vite** (dev server + bundle). The UI is plain HTML in [`index.html`](index.html); canvas logic and HUD wiring live in [`src/app.ts`](src/app.ts) and [`src/silk.ts`](src/silk.ts).

**Educational use only.** This project studies the original **for learning**: algorithms behind the strokes, documentation for humans and **AI coding agents**, and a small sandbox. It is **not** a commercial substitute—only teaching and research.

**Scope:** understand, document, and rebuild the core generative art experience (Weave Silk) in that spirit.

## Original Silk and attribution

The original **Silk** experience is served at **[http://weavesilk.com](http://weavesilk.com)**. Everything below concerns that work and how this repo relates to it.

- **Author:** [Silk / Weave Silk](http://weavesilk.com) was created by **Yuri Vishnevsky**. **Music and sound** are by [Mat Jarvis](http://microscopics.co.uk/) (as credited on the live app).
- **Creative Commons (shared art):** On the classic Silk UI, **art shared with Silk** is described as licensed under [**Creative Commons Attribution 3.0 (CC BY 3.0)**](https://creativecommons.org/licenses/by/3.0/deed.en_US). That wording refers to **user-created artwork** shared through the tool—not a blanket license on site **code**, **branding**, or this repository. If you redistribute clones, recordings, or derivatives, **check the live site** and comply with applicable terms and law.
- **This repository** is **unofficial**. It is **not** affiliated with, endorsed by, or maintained by the original creators. It is **not** the Silk product and must not be presented as one.
- **No claim** is made of ownership over Silk, Weave Silk, or related **trademarks**. Name and describe this project clearly as a **study** or **reimplementation** for education.
- **Respect:** Treat the original as the reference experience; honor **attribution**, **licensing**, and **rights** when using shared assets or publishing anything derived from this work.

## Goal

- Document how the public app achieves mirrored curves, blending, spiral behavior, and real-time drawing (see [docs/SITE-BREAKDOWN.md](docs/SITE-BREAKDOWN.md) and [docs/ALGORITHM.md](docs/ALGORITHM.md)).
- Reproduce the core visual behavior in a clean, documented stack: **TypeScript** + **canvas** (see [`src/silk.ts`](src/silk.ts), [`src/app.ts`](src/app.ts)).

## Constraints (working)

- Educational / research-first: document findings (math, symmetry modes, stroke model) as you go.
- Attribution and relationship to the original: see [Original Silk and attribution](#original-silk-and-attribution) above.

## Local dev

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (port **5174**). The canvas uses the same **`noise()`** implementation as the live site (`public/vendor/noise.js`). **Left bubble:** round button **opens** presets (click without moving) or **drags** the whole bubble; with the panel open, drag the **grip** at the top too. Swatches match the original at [http://weavesilk.com](http://weavesilk.com)—click or **drag between swatches** to blend colors. Bottom HUD: mirror, rotations, spiral, clear, Save PNG.

```bash
npm run build   # output in dist/
```

Deployment (including **GitHub Pages**): [docs/DEPLOY.md](docs/DEPLOY.md).

See [docs/SITE-BREAKDOWN.md](docs/SITE-BREAKDOWN.md) for site stack notes and visual QA checklist, [docs/ALGORITHM.md](docs/ALGORITHM.md) for the mathematical model, [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for scalability limits and cost drivers. [docs/FEATURE.md](docs/FEATURE.md) covers **shipped** HUD features (Auto-draw, Heartbeat, **Ambient sound** — procedural water-like audio, plate coupling, phrase book) plus **next steps** and longer exploratory directions (live drawing, moving canvas, etc.).
