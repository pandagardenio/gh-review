import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The CLI is a Node entry shell run as `triage` (bin → dist/main.js). It bundles
// @triage/fleet (schema + record building) and does the Node I/O — git plumbing,
// fs — itself. Node built-ins stay external; the output carries a shebang.
export default defineConfig({
  build: {
    target: 'node22',
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    sourcemap: true,
    rollupOptions: {
      external: [/^node:/],
      output: { banner: '#!/usr/bin/env node' },
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
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
    },
  },
});
