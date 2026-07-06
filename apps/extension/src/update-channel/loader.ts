/**
 * Thin channel loader (BL-015): read the never-cached manifest, then load the
 * content-hashed bundle it names (MVP.md §5.2).
 *
 * Extension-context only. The loader returns the bundle *source*; executing it
 * is the host's decision where its CSP permits. It is deliberately not wired
 * into the github.com content script or the bookmarklet — GitHub's CSP forbids
 * remote code there (validated, MVP.md §5.2/§6), and MV3 ships the bundle
 * inside the extension anyway. The channel exists so a publish is picked up on
 * the next load by any host that *can* consume it.
 */

import { CHANNEL_MANIFEST_NAME, type ChannelManifest, parseChannelManifest } from './channel.js';

export interface LoadedBundle {
  readonly manifest: ChannelManifest;
  /** Absolute URL the bundle was loaded from. */
  readonly url: string;
  /** The bundle's source text, ready for the host to execute where CSP permits. */
  readonly source: string;
}

/** Injectable fetch boundary (per testing rules: stub here, never the network). */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** `https://cdn.example/triage` and `https://cdn.example/triage/` are the same channel. */
function channelRoot(channelBaseUrl: string): string {
  return channelBaseUrl.endsWith('/') ? channelBaseUrl : `${channelBaseUrl}/`;
}

/**
 * Load the latest published bundle from a channel.
 *
 * The manifest request bypasses every cache (`no-store`, mirroring its
 * publish-side `Cache-Control`), so a new publish is seen immediately; the
 * bundle request uses default caching — safe because its filename is its
 * content hash and it is published immutable.
 */
export async function loadLatestBundle(
  channelBaseUrl: string,
  fetchFn: FetchLike = fetch,
): Promise<LoadedBundle> {
  const root = channelRoot(channelBaseUrl);
  const manifestUrl = new URL(CHANNEL_MANIFEST_NAME, root).toString();
  const manifestResponse = await fetchFn(manifestUrl, { cache: 'no-store' });
  if (!manifestResponse.ok) {
    throw new Error(`Channel manifest request failed: ${manifestResponse.status} ${manifestUrl}`);
  }
  const manifest = parseChannelManifest(await manifestResponse.text());

  const bundleUrl = new URL(manifest.bundle, root).toString();
  const bundleResponse = await fetchFn(bundleUrl);
  if (!bundleResponse.ok) {
    throw new Error(`Channel bundle request failed: ${bundleResponse.status} ${bundleUrl}`);
  }
  return { manifest, url: bundleUrl, source: await bundleResponse.text() };
}
