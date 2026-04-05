# Deploying codeweive

The app is a static **Vite** build: everything needed is under **`dist/`** after `npm run build`.

## Local check of production output

```bash
npm run build
npm run preview
```

[`vite.config.ts`](../vite.config.ts) sets **`base: './'`** so asset URLs are relative. That matches how the site is served from a **GitHub Pages project URL** (e.g. `https://<user>.github.io/codeweive/`).

## GitHub Pages

### Required: publish **`dist/`**, not the repo root

GitHub Pages must use the **workflow artifact** from `npm run build`. If you use **“Deploy from a branch”** with **`main` / `/ (root)`**, the site serves the **raw** [`index.html`](../index.html) from the repo. That file is meant for Vite only: scripts stay as `/src/main.ts` and never run on static hosting, and the app will not load.

**Check:** open [your site](https://dmitrypr.github.io/codeweive/) → **View Page Source**. A **correct** deploy shows:

- `./assets/index-<hash>.js` and `./assets/index-<hash>.css`
- `./vendor/noise.js`

A **broken** (branch-root) deploy shows `/src/main.ts` and/or a broken noise URL—fix the setting below.

### Setup

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions** (not “Deploy from a branch”).
2. Push to **`main`** (or run the workflow manually). The workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) runs `npm ci`, `npm run build`, and uploads **`dist/`**.

After the first successful run, the URL appears under **Settings → Pages** and in the workflow summary (typically `https://dmitrypr.github.io/codeweive/`). If GitHub asks to **approve** the `github-pages` environment for Actions, approve it once.

[`index.html`](../index.html) uses `./vendor/noise.js`; Vite copies `public/vendor/` into `dist/vendor/` on build.
