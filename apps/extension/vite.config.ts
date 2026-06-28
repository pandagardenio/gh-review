import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// MV3 content script bundle. CSP on github.com forbids remote code, so the entry
// shell must be fully self-contained: bundle the engine and UI in (no externals).
// The full extension packaging (manifest wiring, hashed bundle) is BL-014; this
// is just the harness proving the shell bundles engine + UI together.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: resolve(__dirname, 'src/content.ts'),
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
      },
    },
  },
});
