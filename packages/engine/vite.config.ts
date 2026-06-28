import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The engine ships as a library: a single ESM entry plus type declarations.
// It is deliberately framework-free so the same code runs from the bookmarklet
// and the extension (BL-001 acceptance: zero UI / browser-extension imports).
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
