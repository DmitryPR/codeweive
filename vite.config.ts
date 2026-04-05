import { defineConfig } from "vite";

// Relative base so `dist/` works on GitHub Pages project sites
// (e.g. https://<user>.github.io/codeweive/) and local `vite preview`.
export default defineConfig({
  base: "./",
  server: { port: 5174 },
});
