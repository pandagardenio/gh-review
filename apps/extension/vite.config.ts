import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import {
  CHANNEL_MANIFEST_NAME,
  createChannelManifest,
  serializeChannelManifest,
} from './src/update-channel/channel.js';

// MV3 content script bundle. CSP on github.com forbids remote code, so the entry
// shell must be fully self-contained: bundle the engine and UI in (no externals).
// The content script runs in the extension's isolated world; the token store is
// backed by chrome.storage (BL-014).
//
// After a successful write, a writeBundle hook publishes the update channel
// (BL-015) to dist/channel/: the content bundle under its content-hashed name
// plus a manifest naming it. It runs on the in-memory chunk — never on a failed
// build, and without the sourcemap pointer the written file carries (the map is
// not published). The channel version comes from public/manifest.json, the one
// version Chrome enforces. Serve the manifest with MANIFEST_CACHE_CONTROL and
// the hashed bundle with BUNDLE_CACHE_CONTROL (see src/update-channel/channel.ts).
// Extension-only — never wired to the github.com bookmarklet (MVP.md §5.2).
const channelPlugin: Plugin = {
  name: 'emit-update-channel',
  writeBundle(_options, bundle) {
    const chunk = bundle['content.js'];
    if (chunk?.type !== 'chunk') return;
    const { version } = JSON.parse(
      readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf8'),
    ) as { version: string };
    const source = chunk.code.replace(/\/\/# sourceMappingURL=\S+\s*$/, '');
    const hash = createHash('sha256').update(source).digest('hex');
    const manifest = createChannelManifest(version, hash);
    const channelDir = resolve(__dirname, 'dist/channel');
    mkdirSync(channelDir, { recursive: true });
    writeFileSync(resolve(channelDir, manifest.bundle), source);
    writeFileSync(resolve(channelDir, CHANNEL_MANIFEST_NAME), serializeChannelManifest(manifest));
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
      // The entry shell is wiring, not logic.
      exclude: ['src/**/*.test.ts', 'src/content.ts'],
    },
  },
});
