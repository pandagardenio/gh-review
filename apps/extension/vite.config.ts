import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// MV3 content script bundle. CSP on github.com forbids remote code, so the entry
// shell must be fully self-contained: bundle the engine and UI in (no externals).
// The content script runs in the extension's isolated world; the token store is
// backed by chrome.storage (BL-014).
export default defineConfig({
  // Resolve workspace deps from source so build/tests need no prior package build
  // (the per-package Sonar coverage job runs test:coverage outside turbo's ^build).
  resolve: {
    alias: {
      '@triage/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@triage/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: resolve(__dirname, 'src/content.ts'),
      output: { entryFileNames: 'content.js', format: 'iife', inlineDynamicImports: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // The entry shell and version constant are wiring, not logic.
      exclude: ['src/**/*.test.ts', 'src/content.ts', 'src/version.ts'],
    },
  },
});
