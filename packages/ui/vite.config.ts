import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    target: 'es2022',
    // The engine is bundled into each entry shell separately; keep it external
    // here so the UI lib stays a thin, dependency-shared layer.
    rollupOptions: {
      external: ['@triage/engine'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Resolve the workspace engine from source so UI tests don't require a built
    // `dist/` — the per-package Sonar coverage job runs `test:coverage` directly,
    // outside turbo's `^build`, so the engine is otherwise unbuilt there.
    alias: {
      '@triage/engine': resolve(__dirname, '../engine/src/index.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
