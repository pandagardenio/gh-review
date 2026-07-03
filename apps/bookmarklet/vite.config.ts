import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { installPage, packBookmarklet } from './src/pack.js';
import { BOOKMARKLET_VERSION } from './src/version.js';

// The bookmarklet must be a single self-contained IIFE (github.com CSP forbids
// remote code; a `javascript:` URL is CSP-exempt, MVP.md §5.1). So the engine and
// UI are resolved from source and bundled in — never externalized. After the
// bundle is written, a closeBundle hook packs it into `dist/bookmarklet.txt`
// (the javascript: URL) and `dist/install.html`.
const packPlugin = {
  name: 'pack-bookmarklet',
  closeBundle() {
    const source = readFileSync(resolve(__dirname, 'dist/bookmarklet.js'), 'utf8');
    const url = packBookmarklet(source);
    writeFileSync(resolve(__dirname, 'dist/bookmarklet.txt'), url);
    writeFileSync(resolve(__dirname, 'dist/install.html'), installPage(url, BOOKMARKLET_VERSION));
  },
};

export default defineConfig({
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
    rollupOptions: {
      input: resolve(__dirname, 'src/bookmarklet.ts'),
      // Inline everything into one IIFE — no code splitting, no externals.
      output: { entryFileNames: 'bookmarklet.js', format: 'iife', inlineDynamicImports: true },
    },
  },
  plugins: [packPlugin],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/bookmarklet.ts', 'src/version.ts'],
    },
  },
});
