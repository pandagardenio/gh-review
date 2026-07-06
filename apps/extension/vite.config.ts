import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { createChannelManifest, serializeChannelManifest } from './src/update-channel/channel.js';
import { EXTENSION_VERSION } from './src/version.js';

// MV3 content script bundle. CSP on github.com forbids remote code, so the entry
// shell must be fully self-contained: bundle the engine and UI in (no externals).
// The content script runs in the extension's isolated world; the token store is
// backed by chrome.storage (BL-014).
//
// After the bundle is written, a closeBundle hook publishes the update channel
// (BL-015) to dist/channel/: the same bundle under its content-hashed name plus
// a manifest.json naming it. Serve the manifest with MANIFEST_CACHE_CONTROL and
// the hashed bundle with BUNDLE_CACHE_CONTROL (see src/update-channel/channel.ts).
// Extension-only — never wired to the github.com bookmarklet (MVP.md §5.2).
const channelPlugin = {
  name: 'emit-update-channel',
  closeBundle() {
    const bundlePath = resolve(__dirname, 'dist/content.js');
    const hash = createHash('sha256').update(readFileSync(bundlePath)).digest('hex');
    const manifest = createChannelManifest(EXTENSION_VERSION, hash);
    const channelDir = resolve(__dirname, 'dist/channel');
    mkdirSync(channelDir, { recursive: true });
    copyFileSync(bundlePath, resolve(channelDir, manifest.bundle));
    writeFileSync(resolve(channelDir, 'manifest.json'), serializeChannelManifest(manifest));
  },
};

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
  plugins: [channelPlugin],
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
