import { describe, expect, it, vi } from 'vitest';
import type { PullRequestRef } from '../diff/coordinates.js';
import { InMemoryTokenStore } from '../token-store.js';
import type { DraftComment } from './comments.js';
import { intentToEvent, type ReviewSubmission, ReviewSubmitError, submitReview } from './submit.js';

const ref: PullRequestRef = { owner: 'octo', repo: 'repo', number: 7, headSha: 'headsha' };

const comment: DraftComment = { path: 'src/a.ts', line: 12, side: 'RIGHT', body: 'nit' };

const submission = (over: Partial<ReviewSubmission> = {}): ReviewSubmission => ({
  event: 'COMMENT',
  body: 'Overall looks good',
  comments: [comment],
  ...over,
});

function okResponse(body: unknown): Response {
  return { ok: true, status: 201, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('intentToEvent', () => {
  it('maps draft intent to a GitHub event, null for none', () => {
    expect(intentToEvent('approve')).toBe('APPROVE');
    expect(intentToEvent('request-changes')).toBe('REQUEST_CHANGES');
    expect(intentToEvent('comment')).toBe('COMMENT');
    expect(intentToEvent('none')).toBeNull();
  });
});

describe('submitReview', () => {
  it('POSTs one review with commit_id, event, body and anchored comments', async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse({ id: 555, html_url: 'https://gh/r/555' }));
    const result = await submitReview(ref, submission(), {
      tokens: new InMemoryTokenStore('ghp_tok'),
      fetch,
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/octo/repo/pulls/7/reviews');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_tok');
    expect(JSON.parse(init.body as string)).toEqual({
      commit_id: 'headsha',
      event: 'COMMENT',
      body: 'Overall looks good',
      comments: [{ path: 'src/a.ts', line: 12, side: 'RIGHT', body: 'nit' }],
    });
    expect(result).toEqual({ id: 555, htmlUrl: 'https://gh/r/555' });
  });

  it('omits an empty body', async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse({ id: 1, html_url: 'x' }));
    await submitReview(ref, submission({ event: 'APPROVE', body: '' }), {
      tokens: new InMemoryTokenStore('t'),
      fetch,
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).not.toHaveProperty('body');
  });

  it('throws missing-token (nothing sent) when no token is stored', async () => {
    const fetch = vi.fn();
    await expect(
      submitReview(ref, submission(), { tokens: new InMemoryTokenStore(), fetch }),
    ).rejects.toMatchObject({ reason: 'missing-token' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces an http-error with status on a failed submit (draft kept by caller)', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response);
    const error = await submitReview(ref, submission(), {
      tokens: new InMemoryTokenStore('t'),
      fetch,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ReviewSubmitError);
    expect(error.reason).toBe('http-error');
    expect(error.status).toBe(422);
  });

  it('reports a network error when fetch throws', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      submitReview(ref, submission(), { tokens: new InMemoryTokenStore('t'), fetch }),
    ).rejects.toMatchObject({ reason: 'network' });
  });

  it('reports a parse-error when the success body is not JSON', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as unknown as Response);
    await expect(
      submitReview(ref, submission(), { tokens: new InMemoryTokenStore('t'), fetch }),
    ).rejects.toMatchObject({ reason: 'parse-error' });
  });
});
