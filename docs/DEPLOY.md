# Deploying codeweive

The app is a static **Vite** build: everything needed is under **`dist/`** after `npm run build`.

## Local check of production output

```bash
npm run build
npm run preview
```

[`vite.config.ts`](../vite.config.ts) sets **`base: './'`** so asset URLs are relative. That matches how the site is served from a **GitHub Pages project URL** (e.g. `https://<user>.github.io/codeweive/`).

## GitHub Pages

1. In the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to **`main`**. The workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) runs `npm ci`, `npm run build`, and publishes **`dist/`**.

After the first successful run, the live URL appears under **Settings → Pages** and in the workflow summary (for this repository, typically `https://dmitrypr.github.io/codeweive/`).

`index.html` loads Perlin noise via `%BASE_URL%vendor/noise.js` so the built `dist/index.html` references `./vendor/noise.js` next to hashed JS/CSS.
