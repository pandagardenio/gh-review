import { describe, expect, it, vi } from 'vitest';
import { InMemoryConditionalCache } from './cache.js';
import { GitHubApiError, GitHubClient } from './client.js';

const tokens = { get: async () => 'ghp_token', set: async () => {}, clear: async () => {} };

function res(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Map(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
  } as unknown as Response;
}

const setup = (fetch: typeof globalThis.fetch, cache = new InMemoryConditionalCache()) =>
  new GitHubClient({ tokens, fetch, cache });

describe('GitHubClient.getPaged', () => {
  it('sends auth + version headers and returns the parsed array', async () => {
    const fetch = vi.fn(async () => res([{ a: 1 }]));
    const data = await setup(fetch as unknown as typeof globalThis.fetch).getPaged('/x');
    expect(data).toEqual([{ a: 1 }]);
    const headers = (fetch.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ghp_token');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('follows Link rel="next" pagination', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        res([{ a: 1 }], { headers: { Link: '<https://api.github.com/x?page=2>; rel="next"' } }),
      )
      .mockResolvedValueOnce(res([{ a: 2 }]));
    const data = await setup(fetch as unknown as typeof globalThis.fetch).getPaged('/x');
    expect(data).toEqual([{ a: 1 }, { a: 2 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('caches the ETag and serves a 304 refresh from cache', async () => {
    const cache = new InMemoryConditionalCache();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(res([{ a: 1 }], { headers: { ETag: 'W/"v1"' } }))
      .mockResolvedValueOnce(res(null, { status: 304 }));
    const client = setup(fetch as unknown as typeof globalThis.fetch, cache);

    expect(await client.getPaged('/x')).toEqual([{ a: 1 }]);
    expect(await client.getPaged('/x')).toEqual([{ a: 1 }]); // served from cache on 304
    const secondHeaders = (fetch.mock.calls[1]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(secondHeaders['If-None-Match']).toBe('W/"v1"');
  });

  it('does not cache a multi-page resource (a page-1 ETag cannot vouch for later pages)', async () => {
    const cache = new InMemoryConditionalCache();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        res([{ a: 1 }], {
          headers: { ETag: 'W/"v1"', Link: '<https://api.github.com/x?page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(res([{ a: 2 }]));
    await setup(fetch as unknown as typeof globalThis.fetch, cache).getPaged('/x');
    expect(cache.get('https://api.github.com/x')).toBeUndefined();
  });

  it('does not carry the If-None-Match header onto pages 2..N', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        res([{ a: 1 }], {
          headers: { ETag: 'W/"v1"', Link: '<https://api.github.com/x?page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(res([{ a: 2 }]));
    const cache = new InMemoryConditionalCache();
    cache.set('https://api.github.com/x', { etag: 'W/"prev"', body: '[]' });
    await setup(fetch as unknown as typeof globalThis.fetch, cache).getPaged('/x');
    const pageTwoHeaders = (fetch.mock.calls[1]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(pageTwoHeaders['If-None-Match']).toBeUndefined();
  });

  it('stops paginating when stopWhen returns true', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        res([{ n: 1 }], { headers: { Link: '<https://api.github.com/x?page=2>; rel="next"' } }),
      )
      .mockResolvedValueOnce(res([{ n: 2 }]));
    const data = await setup(fetch as unknown as typeof globalThis.fetch).getPaged<{ n: number }>(
      '/x',
      {
        stopWhen: (page) => page.some((item) => item.n === 1),
      },
    );
    expect(data).toEqual([{ n: 1 }]); // stopped after page 1, page 2 never fetched
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('classifies HTTP failures into plain error kinds', async () => {
    const kinds = [
      { status: 401, headers: {}, kind: 'unauthorized' },
      { status: 404, headers: {}, kind: 'not-found' },
      { status: 403, headers: { 'x-ratelimit-remaining': '0' }, kind: 'rate-limited' },
      { status: 403, headers: {}, kind: 'unauthorized' },
      { status: 429, headers: {}, kind: 'rate-limited' },
      { status: 500, headers: {}, kind: 'unknown' },
    ];
    for (const { status, headers, kind } of kinds) {
      const client = setup((async () =>
        res({}, { status, headers })) as unknown as typeof globalThis.fetch);
      await expect(client.getPaged('/x')).rejects.toMatchObject({ kind });
    }
  });

  it('surfaces a thrown fetch as a network error', async () => {
    const fetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof globalThis.fetch;
    await expect(setup(fetch).getPaged('/x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('carries retry-after seconds on a rate-limit error', async () => {
    const client = setup((async () =>
      res(
        {},
        { status: 403, headers: { 'retry-after': '42' } },
      )) as unknown as typeof globalThis.fetch);
    await expect(client.getPaged('/x')).rejects.toMatchObject({
      kind: 'rate-limited',
      retryAfterSeconds: 42,
    });
  });

  it('throws unauthorized when no token is configured', async () => {
    const client = new GitHubClient({
      tokens: { get: async () => null, set: async () => {}, clear: async () => {} },
      fetch: (async () => res([])) as unknown as typeof globalThis.fetch,
    });
    await expect(client.getPaged('/x')).rejects.toBeInstanceOf(GitHubApiError);
  });
});
