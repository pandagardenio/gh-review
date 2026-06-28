import { defineConfig } from 'vite';

// Placeholder web app — built out later (MVP.md). Standard Vite SPA build.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
