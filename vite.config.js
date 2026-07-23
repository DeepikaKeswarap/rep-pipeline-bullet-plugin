import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sigma's dev playground defaults to http://localhost:5173 (Vite's default),
// so we keep the default port. See README.md for registration steps.
export default defineConfig({
  // Relative base so built assets resolve when served from a GitHub Pages
  // subpath (e.g. /rep-pipeline-bullet-plugin/) — used as the Sigma plugin
  // Production URL.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
