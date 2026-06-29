import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The action is a Node CLI entry shell: it bundles @triage/engine and runs under
// `node dist/main.js` in CI. Node built-ins stay external; the engine is bundled
// in so the shipped file is self-contained. No DOM, no browser — pure Node I/O.
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
