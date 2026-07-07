import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The fleet core ships as a library: a single ESM entry plus type declarations.
// Same isolation discipline as the engine — framework-free, no DOM, no app
// imports — so the same roll-ups run from the CLI (node) and the web cockpit.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
