import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  optimizeDeps: { exclude: ['manifold-3d'] },
});
