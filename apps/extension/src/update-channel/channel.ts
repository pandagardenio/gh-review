/**
 * CDN + manifest update channel — publishing model (BL-015).
 *
 * The channel is two artifacts on a static host: a content-hashed, immutable
 * bundle and a tiny, never-cached `manifest.json` naming the latest bundle
 * (MVP.md §5.2). This module is the pure model: naming, serialization, and the
 * validated cache policy. The build wires it up (vite.config.ts emits
 * `dist/channel/`); {@link loadLatestBundle} consumes it.
 *
 * Hard constraint (validated, MVP.md §5.2): this channel serves the extension
 * (or a future non-GitHub host whose CSP permits it) — **never** the github.com
 * bookmarklet, which stays self-contained (BL-013). The `channel-isolation`
 * forbidden-pattern rule enforces that at write time.
 */

/** Fixed name of the channel's entry-point file. */
export const CHANNEL_MANIFEST_NAME = 'manifest.json';

/** The manifest must be revalidated on every load — it names the latest build. */
export const MANIFEST_CACHE_CONTROL = 'no-store';

/** The bundle's filename is its content hash, so it may be cached forever. */
export const BUNDLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Manifest schema version, bumped only on breaking shape changes. */
export const CHANNEL_SCHEMA = 1;

/** Hex-digit prefix of the content hash kept in the bundle filename. */
const HASH_PREFIX_LENGTH = 16;

export interface ChannelManifest {
  readonly schema: typeof CHANNEL_SCHEMA;
  /** Human-readable build version (mirrors the extension version). */
  readonly version: string;
  /** Content-hashed bundle filename, relative to the manifest. */
  readonly bundle: string;
}

/** Name a bundle by (a prefix of) its SHA-256 content hash. */
export function hashedBundleName(sha256Hex: string): string {
  if (!/^[0-9a-f]{64}$/i.test(sha256Hex)) {
    throw new Error('hashedBundleName expects a full SHA-256 hex digest');
  }
  return `triage-${sha256Hex.slice(0, HASH_PREFIX_LENGTH).toLowerCase()}.js`;
}

/** Build the manifest entry for a freshly built bundle. */
export function createChannelManifest(version: string, sha256Hex: string): ChannelManifest {
  if (version.trim() === '') throw new Error('createChannelManifest needs a non-empty version');
  return { schema: CHANNEL_SCHEMA, version, bundle: hashedBundleName(sha256Hex) };
}

export function serializeChannelManifest(manifest: ChannelManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Parse and validate a fetched manifest. Throws with a reason naming the
 * defect — a channel misconfiguration must never be mistaken for a network
 * failure (same discipline as the diff loader's error labelling).
 */
export function parseChannelManifest(text: string): ChannelManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Channel manifest is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Channel manifest must be a JSON object');
  }
  const { schema, version, bundle } = raw as Record<string, unknown>;
  if (schema !== CHANNEL_SCHEMA) {
    throw new Error(
      `Channel manifest schema ${String(schema)} is not supported (expected ${CHANNEL_SCHEMA})`,
    );
  }
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error('Channel manifest is missing a version');
  }
  if (typeof bundle !== 'string' || !/^[\w.-]+\.js$/.test(bundle)) {
    throw new Error('Channel manifest bundle must be a plain .js filename next to the manifest');
  }
  return { schema: CHANNEL_SCHEMA, version, bundle };
}
