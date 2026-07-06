import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createChannelManifest, serializeChannelManifest } from './channel.js';
import { ChannelLoadError, loadLatestBundle } from './loader.js';

const CHANNEL = 'https://cdn.example/triage';

/** Fake CDN: a mutable file map plus a log of every request the loader makes. */
function setup(files: Record<string, string>) {
  const requests: Array<{ url: string; cache?: RequestCache }> = [];
  const doFetch = ((url: string, init?: RequestInit) => {
    requests.push({ url, cache: init?.cache });
    const body = files[url];
    return Promise.resolve(
      body === undefined ? new Response('not found', { status: 404 }) : new Response(body),
    );
  }) as typeof globalThis.fetch;
  return { files, requests, fetch: doFetch };
}

/** Publish a build the way the channel build does: hash the source, name by it. */
function publish(files: Record<string, string>, version: string, source: string) {
  const hash = createHash('sha256').update(source).digest('hex');
  const manifest = createChannelManifest(version, hash);
  files[`${CHANNEL}/${manifest.bundle}`] = source;
  files[`${CHANNEL}/manifest.json`] = serializeChannelManifest(manifest);
  return manifest;
}

async function loadError(promise: Promise<unknown>): Promise<ChannelLoadError> {
  const error = await promise.then(
    () => {
      throw new Error('expected loadLatestBundle to reject');
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ChannelLoadError);
  return error as ChannelLoadError;
}

describe('loadLatestBundle', () => {
  it('reads the manifest, then loads the hashed bundle it names', async () => {
    const cdn = setup({});
    const published = publish(cdn.files, '1.0.0', 'bundle-one();');

    const loaded = await loadLatestBundle(CHANNEL, { fetch: cdn.fetch });

    expect(loaded.manifest.version).toBe('1.0.0');
    expect(loaded.url).toBe(`${CHANNEL}/${published.bundle}`);
    expect(loaded.source).toBe('bundle-one();');
  });

  it('bypasses caches for the manifest but not for the immutable bundle', async () => {
    const cdn = setup({});
    const published = publish(cdn.files, '1.0.0', 'bundle-one();');

    await loadLatestBundle(CHANNEL, { fetch: cdn.fetch });

    expect(cdn.requests).toEqual([
      { url: `${CHANNEL}/manifest.json`, cache: 'no-store' },
      { url: `${CHANNEL}/${published.bundle}`, cache: undefined },
    ]);
  });

  it('picks up a new publish on the next load', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', 'bundle-one();');
    await loadLatestBundle(CHANNEL, { fetch: cdn.fetch });

    const second = publish(cdn.files, '1.1.0', 'bundle-two();');
    const loaded = await loadLatestBundle(CHANNEL, { fetch: cdn.fetch });

    expect(loaded.manifest.version).toBe('1.1.0');
    expect(loaded.url).toBe(`${CHANNEL}/${second.bundle}`);
    expect(loaded.source).toBe('bundle-two();');
  });

  it('treats the channel URL the same with or without a trailing slash', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', 'bundle-one();');

    const bare = await loadLatestBundle(CHANNEL, { fetch: cdn.fetch });
    const slashed = await loadLatestBundle(`${CHANNEL}/`, { fetch: cdn.fetch });

    expect(slashed.url).toBe(bare.url);
  });

  it('rejects a bundle whose bytes do not match the manifest sha256', async () => {
    const cdn = setup({});
    const published = publish(cdn.files, '1.0.0', 'bundle-one();');
    cdn.files[`${CHANNEL}/${published.bundle}`] = 'tampered();';

    const error = await loadError(loadLatestBundle(CHANNEL, { fetch: cdn.fetch }));
    expect(error.reason).toBe('integrity-mismatch');
    expect(error.message).toContain(published.sha256);
  });

  it('tags an HTTP failure on the manifest with http-error and the step name', async () => {
    const cdn = setup({});
    const error = await loadError(loadLatestBundle(CHANNEL, { fetch: cdn.fetch }));
    expect(error.reason).toBe('http-error');
    expect(error.status).toBe(404);
    expect(error.message).toContain('manifest');
  });

  it('tags an HTTP failure on the bundle with http-error and the step name', async () => {
    const cdn = setup({});
    const published = publish(cdn.files, '1.0.0', 'bundle-one();');
    delete cdn.files[`${CHANNEL}/${published.bundle}`];

    const error = await loadError(loadLatestBundle(CHANNEL, { fetch: cdn.fetch }));
    expect(error.reason).toBe('http-error');
    expect(error.status).toBe(404);
    expect(error.message).toContain('bundle');
  });

  it('tags a thrown fetch as network, never as a manifest defect', async () => {
    const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    const error = await loadError(loadLatestBundle(CHANNEL, { fetch: offline }));
    expect(error.reason).toBe('network');
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('tags a manifest defect as manifest-invalid, never as a network failure', async () => {
    const cdn = setup({ [`${CHANNEL}/manifest.json`]: '{nope' });
    const error = await loadError(loadLatestBundle(CHANNEL, { fetch: cdn.fetch }));
    expect(error.reason).toBe('manifest-invalid');
    expect(error.message).toContain('not valid JSON');
  });
});
