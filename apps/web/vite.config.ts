import { defineConfig } from 'vitest/config';

// Control Room web cockpit — a standard Vite SPA. It consumes @triage/engine and
// @triage/ui (CSP-safe DOM helpers); the data layer is a pluggable FactorySource
// so the app runs on baked fixtures with zero config and on a live repo with a token.
export default defineConfig({
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
