import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Control Room web cockpit — a standard Vite SPA. It consumes @triage/engine and
// @triage/ui (CSP-safe DOM helpers); the data layer is a pluggable FactorySource
// so the app runs on baked fixtures with zero config and on a live repo with a token.
export default defineConfig({
  // Resolve @triage/ui to its source so tests (and dev/build) work without a prior
  // package build — the per-package Sonar CI matrix runs test:coverage without
  // building workspace deps, so the published dist/ may not exist yet.
  resolve: {
    alias: {
      '@triage/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@triage/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    // jsdom: the views build real DOM via @triage/ui; the ledger logic is pure
    // and runs fine here too.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
    },
  },
});
