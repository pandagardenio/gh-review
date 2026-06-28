import { describe, expect, it, vi } from 'vitest';
import { InMemoryTokenStore } from '../token-store.js';
import type { PullRequestRef } from './coordinates.js';
import { DiffLoadError } from './errors.js';
import { loadPullRequestDiff } from './loader.js';

const REF: PullRequestRef = { owner: 'octo', repo: 'repo', number: 42, headSha: 'deadbeef' };

const DIFF_BODY = [
  'diff --git a/src/app.ts b/src/app.ts',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-a',
  '+b',
  '',
].join('\n');

function textResponse(body: string, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; link?: string } = {},
): Response {
  const headers = new Headers();
  if (init.link) headers.set('Link', init.link);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
    headers,
  } as unknown as Response;
}

describe('loadPullRequestDiff', () => {
  it('uses the .diff fast path with no token on a public PR', async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse(DIFF_BODY));
    const tokens = new InMemoryTokenStore(); // empty — must not be needed

    const result = await loadPullRequestDiff(REF, { tokens, fetch });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe('https://github.com/octo/repo/pull/42.diff');
    expect(result.headSha).toBe('deadbeef');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('src/app.ts');
  });

  it('falls back to the API when the .diff fetch throws (CSP-blocked redirect, private PR)', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        jsonResponse([
          { filename: 'a.ts', status: 'modified', additions: 2, deletions: 0, patch: '@@\n+x\n+y' },
        ]),
      );
    const tokens = new InMemoryTokenStore('ghp_token');

    const result = await loadPullRequestDiff(REF, { tokens, fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
    const apiCall = fetch.mock.calls[1];
    expect(apiCall[0]).toBe('https://api.github.com/repos/octo/repo/pulls/42/files?per_page=100');
    expect((apiCall[1].headers as Record<string, string>).Authorization).toBe('Bearer ghp_token');
    expect(result.files[0].path).toBe('a.ts');
  });

  it('falls back to the API when the .diff path returns non-OK', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse('', { ok: false, status: 406 }))
      .mockResolvedValueOnce(
        jsonResponse([
          { filename: 'b.ts', status: 'added', additions: 1, deletions: 0, patch: '@@\n+x' },
        ]),
      );
    const result = await loadPullRequestDiff(REF, { tokens: new InMemoryTokenStore('t'), fetch });
    expect(result.files[0].path).toBe('b.ts');
  });

  it('throws missing-token (not "PR too large") when the fallback has no token', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const tokens = new InMemoryTokenStore(); // no token

    await expect(loadPullRequestDiff(REF, { tokens, fetch })).rejects.toMatchObject({
      reason: 'missing-token',
    });
  });

  it('surfaces an http-error with its status on an API failure', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const error = await loadPullRequestDiff(REF, {
      tokens: new InMemoryTokenStore('t'),
      fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(DiffLoadError);
    expect(error.reason).toBe('http-error');
    expect(error.status).toBe(404);
  });

  it('follows Link pagination across pages', async () => {
    const page2 = 'https://api.github.com/repos/octo/repo/pulls/42/files?per_page=100&page=2';
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        jsonResponse(
          [{ filename: 'p1.ts', status: 'added', additions: 1, deletions: 0, patch: '@@\n+x' }],
          {
            link: `<${page2}>; rel="next"`,
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { filename: 'p2.ts', status: 'added', additions: 1, deletions: 0, patch: '@@\n+y' },
        ]),
      );

    const result = await loadPullRequestDiff(REF, { tokens: new InMemoryTokenStore('t'), fetch });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toBe(page2);
    expect(result.files.map((f) => f.path)).toEqual(['p1.ts', 'p2.ts']);
  });
});
