import { InMemoryTokenStore } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createReviewApp } from './review-app.js';

const PR_URL = 'https://github.com/octo/repo/pull/1';

const DIFF_BODY = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1 +1 @@',
  '-a',
  '+b',
  '',
].join('\n');

/** Route fetch by URL: the PR metadata (head sha) and the `.diff` fast path. */
const fakeFetch = vi.fn(async (url: string) => {
  if (url.includes('api.github.com')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ head: { sha: 'headsha' } }),
      headers: new Headers(),
    } as unknown as Response;
  }
  return {
    ok: true,
    status: 200,
    text: async () => DIFF_BODY,
    headers: new Headers(),
  } as unknown as Response;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createReviewApp', () => {
  it('shows an empty-state notice off a non-PR page', () => {
    const panel = createReviewApp({
      tokens: new InMemoryTokenStore(),
      version: '1.0.0',
      location: 'https://github.com/octo/repo',
    });
    expect(panel.querySelector('.triage-app__empty')).not.toBeNull();
    expect(panel.querySelector('.triage-app__load')).toBeNull();
  });

  it('shows the version and the token entry with its warning', () => {
    const panel = createReviewApp({
      tokens: new InMemoryTokenStore(),
      version: '2.3.4',
      location: PR_URL,
    });
    expect(panel.querySelector('.triage-app__head')?.textContent).toContain('2.3.4');
    expect(panel.querySelector('.triage-token__warning')).not.toBeNull();
  });

  it('loads the diff and renders the review flow on demand', async () => {
    const panel = createReviewApp({
      tokens: new InMemoryTokenStore('ghp_t'),
      version: '1.0.0',
      location: PR_URL,
      fetch: fakeFetch as unknown as typeof fetch,
    });
    (panel.querySelector('.triage-app__load') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(panel.querySelector('.triage-review')).not.toBeNull();
    expect(panel.querySelector('.triage-finish')).not.toBeNull();
  });

  it('surfaces a load failure without throwing', async () => {
    const panel = createReviewApp({
      tokens: new InMemoryTokenStore(),
      version: '1.0.0',
      location: PR_URL,
      fetch: (() => Promise.reject(new Error('boom'))) as unknown as typeof fetch,
    });
    (panel.querySelector('.triage-app__load') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(panel.querySelector('.triage-app__error')?.textContent).toContain('Failed to load');
  });

  it('falls back to the page location when none is given (non-PR default)', () => {
    // jsdom's default location (http://localhost/) is not a PR → empty state.
    const panel = createReviewApp({ tokens: new InMemoryTokenStore(), version: '1.0.0' });
    expect(panel.querySelector('.triage-app__empty')).not.toBeNull();
  });

  it('uses the global fetch and defaults the head SHA when absent', async () => {
    const headless = vi.fn(async (url: string) => {
      if (url.includes('api.github.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers(),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => DIFF_BODY,
        headers: new Headers(),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', headless);
    try {
      // No `fetch` option → exercises the global-fetch fallback; no head.sha → 'HEAD'.
      const panel = createReviewApp({
        tokens: new InMemoryTokenStore('t'),
        version: '1.0.0',
        location: PR_URL,
      });
      (panel.querySelector('.triage-app__load') as HTMLButtonElement).click();
      await flush();
      await flush();
      expect(panel.querySelector('.triage-review')).not.toBeNull();
      expect(headless).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
