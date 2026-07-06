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

export type ChannelLoadReason =
  /** A fetch threw (offline, DNS, connection reset). */
  | 'network'
  /** The channel host answered with a non-OK HTTP status. */
  | 'http-error'
  /** The manifest was fetched but is not a valid channel manifest. */
  | 'manifest-invalid';

/**
 * A channel-load failure tagged with a {@link ChannelLoadReason}, so callers
 * can branch without matching message prose — the same discipline as the
 * engine's `DiffLoadError`. A channel misconfiguration (`manifest-invalid`)
 * must never be mistaken for a network failure.
 */
export class ChannelLoadError extends Error {
  readonly reason: ChannelLoadReason;
  /** HTTP status when {@link reason} is `http-error`. */
  readonly status?: number;

  constructor(
    reason: ChannelLoadReason,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ChannelLoadError';
    this.reason = reason;
    this.status = options.status;
  }
}

export interface LoadedBundle {
  readonly manifest: ChannelManifest;
  /** Absolute URL the bundle was loaded from. */
  readonly url: string;
  /** The bundle's source text, ready for the host to execute where CSP permits. */
  readonly source: string;
}

export interface LoadBundleOptions {
  /** Injectable fetch boundary (per testing rules: stub here, never the network). */
  readonly fetch?: typeof globalThis.fetch;
}

/** `https://cdn.example/triage` and `https://cdn.example/triage/` are the same channel. */
function channelRoot(channelBaseUrl: string): string {
  return channelBaseUrl.endsWith('/') ? channelBaseUrl : `${channelBaseUrl}/`;
}

/** Fetch one channel file, labelling network vs HTTP failures with the step name. */
async function fetchChannelFile(
  doFetch: typeof globalThis.fetch,
  step: 'manifest' | 'bundle',
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await doFetch(url, init);
  } catch (cause) {
    throw new ChannelLoadError(
      'network',
      `Network error during the channel ${step} request: ${url}`,
      {
        cause,
      },
    );
  }
  if (!response.ok) {
    throw new ChannelLoadError(
      'http-error',
      `Channel ${step} request failed: ${response.status} ${url}`,
      {
        status: response.status,
      },
    );
  }
  return response;
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
  options: LoadBundleOptions = {},
): Promise<LoadedBundle> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const root = channelRoot(channelBaseUrl);

  const manifestUrl = new URL(CHANNEL_MANIFEST_NAME, root).toString();
  const manifestResponse = await fetchChannelFile(doFetch, 'manifest', manifestUrl, {
    cache: 'no-store',
  });
  let manifest: ChannelManifest;
  try {
    manifest = parseChannelManifest(await manifestResponse.text());
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'unreadable manifest';
    throw new ChannelLoadError('manifest-invalid', `Channel manifest is invalid: ${detail}`, {
      cause,
    });
  }

  const bundleUrl = new URL(manifest.bundle, root).toString();
  const bundleResponse = await fetchChannelFile(doFetch, 'bundle', bundleUrl);
  return { manifest, url: bundleUrl, source: await bundleResponse.text() };
}
