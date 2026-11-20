import { defineConfig } from 'vite';

// './' makes every asset path relative, so the site works at
// https://hamzak2232.github.io/our-universe/ (or any other repo name).
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
});
