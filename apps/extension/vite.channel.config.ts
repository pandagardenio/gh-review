import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import {
  CHANNEL_MANIFEST_NAME,
  createChannelManifest,
  serializeChannelManifest,
} from './src/update-channel/channel.js';

// Update-channel publish build (BL-015) — runs after the main extension build
// (see the package build script) and emits dist/channel/: the host-agnostic
// channel entry (src/channel-entry.ts — no chrome.*, unlike the content
// script) under its content-hashed name, plus a manifest.json naming it with
// its full sha256. The version comes from public/manifest.json, the one
// version Chrome enforces. Serve the manifest with MANIFEST_CACHE_CONTROL and
// the hashed bundle with BUNDLE_CACHE_CONTROL (see src/update-channel/channel.ts).
// Extension-only — never wired to the github.com bookmarklet (MVP.md §5.2).
const ENTRY_NAME = 'channel-entry.js';

const version = (
  JSON.parse(readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf8')) as {
    version: string;
  }
).version;

const channelPublishPlugin: Plugin = {
  name: 'publish-update-channel',
  generateBundle(_options, bundle) {
    const chunk = bundle[ENTRY_NAME];
    if (chunk?.type !== 'chunk') return;
    const hash = createHash('sha256').update(chunk.code).digest('hex');
    const manifest = createChannelManifest(version, hash);
    delete bundle[ENTRY_NAME];
    chunk.fileName = manifest.bundle;
    bundle[manifest.bundle] = chunk;
    this.emitFile({
      type: 'asset',
      fileName: CHANNEL_MANIFEST_NAME,
      source: serializeChannelManifest(manifest),
    });
  },
};

export default defineConfig({
  // Same source-resolved workspace deps as the main build.
  resolve: {
    alias: {
      '@triage/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@triage/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  define: { __CHANNEL_VERSION__: JSON.stringify(version) },
  publicDir: false,
  build: {
    outDir: 'dist/channel',
    // The main build's emptyOutDir already cleared dist/; only clear our dir.
    emptyOutDir: true,
    // Sourcemaps are not part of the channel (the manifest names one file).
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: resolve(__dirname, 'src/channel-entry.ts'),
      output: { entryFileNames: ENTRY_NAME, format: 'iife', inlineDynamicImports: true },
    },
  },
  plugins: [channelPublishPlugin],
});
