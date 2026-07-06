import { describe, expect, it } from 'vitest';
import { createChannelManifest, serializeChannelManifest } from './channel.js';
import { type FetchLike, loadLatestBundle } from './loader.js';

const HASH_V1 = '1111111111111111111111111111111111111111111111111111111111111111';
const HASH_V2 = '2222222222222222222222222222222222222222222222222222222222222222';
const CHANNEL = 'https://cdn.example/triage';

/** Fake CDN: a mutable file map plus a log of every request the loader makes. */
function setup(files: Record<string, string>) {
  const requests: Array<{ url: string; cache?: RequestCache }> = [];
  const fetchFn: FetchLike = (url, init) => {
    requests.push({ url, cache: init?.cache });
    const body = files[url];
    return Promise.resolve(
      body === undefined ? new Response('not found', { status: 404 }) : new Response(body),
    );
  };
  return { files, requests, fetchFn };
}

function publish(files: Record<string, string>, version: string, hash: string, source: string) {
  const manifest = createChannelManifest(version, hash);
  files[`${CHANNEL}/${manifest.bundle}`] = source;
  files[`${CHANNEL}/manifest.json`] = serializeChannelManifest(manifest);
}

describe('loadLatestBundle', () => {
  it('reads the manifest, then loads the hashed bundle it names', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', HASH_V1, 'bundle-one();');

    const loaded = await loadLatestBundle(CHANNEL, cdn.fetchFn);

    expect(loaded.manifest.version).toBe('1.0.0');
    expect(loaded.url).toBe(`${CHANNEL}/triage-1111111111111111.js`);
    expect(loaded.source).toBe('bundle-one();');
  });

  it('bypasses caches for the manifest but not for the immutable bundle', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', HASH_V1, 'bundle-one();');

    await loadLatestBundle(CHANNEL, cdn.fetchFn);

    expect(cdn.requests).toEqual([
      { url: `${CHANNEL}/manifest.json`, cache: 'no-store' },
      { url: `${CHANNEL}/triage-1111111111111111.js`, cache: undefined },
    ]);
  });

  it('picks up a new publish on the next load', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', HASH_V1, 'bundle-one();');
    await loadLatestBundle(CHANNEL, cdn.fetchFn);

    publish(cdn.files, '1.1.0', HASH_V2, 'bundle-two();');
    const loaded = await loadLatestBundle(CHANNEL, cdn.fetchFn);

    expect(loaded.manifest.version).toBe('1.1.0');
    expect(loaded.url).toBe(`${CHANNEL}/triage-2222222222222222.js`);
    expect(loaded.source).toBe('bundle-two();');
  });

  it('treats the channel URL the same with or without a trailing slash', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', HASH_V1, 'bundle-one();');

    const bare = await loadLatestBundle(CHANNEL, cdn.fetchFn);
    const slashed = await loadLatestBundle(`${CHANNEL}/`, cdn.fetchFn);

    expect(slashed.url).toBe(bare.url);
  });

  it('names the failing step when the manifest request fails', async () => {
    const cdn = setup({});
    await expect(loadLatestBundle(CHANNEL, cdn.fetchFn)).rejects.toThrow(
      /manifest request failed: 404/,
    );
  });

  it('names the failing step when the bundle request fails', async () => {
    const cdn = setup({});
    publish(cdn.files, '1.0.0', HASH_V1, 'bundle-one();');
    delete cdn.files[`${CHANNEL}/triage-1111111111111111.js`];

    await expect(loadLatestBundle(CHANNEL, cdn.fetchFn)).rejects.toThrow(
      /bundle request failed: 404/,
    );
  });

  it('surfaces a manifest defect as a defect, not a network failure', async () => {
    const cdn = setup({ [`${CHANNEL}/manifest.json`]: '{nope' });
    await expect(loadLatestBundle(CHANNEL, cdn.fetchFn)).rejects.toThrow(/not valid JSON/);
  });
});
