import type { DraftComment, PullRequestRef } from '@triage/engine';
import { InMemoryTokenStore } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createFinishReview } from './finish-review.js';

const ref: PullRequestRef = { owner: 'octo', repo: 'repo', number: 7, headSha: 'sha' };
const comments: DraftComment[] = [{ path: 'a.ts', line: 1, side: 'RIGHT', body: 'nit' }];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (fetch: typeof globalThis.fetch, onSubmitted = vi.fn()) => {
  const node = createFinishReview(ref, {
    tokens: new InMemoryTokenStore('tok'),
    fetch,
    getComments: () => comments,
    onSubmitted,
  });
  const pick = (value: string) => {
    const radio = node.querySelector(`.triage-finish__event[value="${value}"]`) as HTMLInputElement;
    radio.checked = true;
  };
  const submit = () => (node.querySelector('.triage-finish__submit') as HTMLButtonElement).click();
  return { node, pick, submit, onSubmitted };
};

describe('createFinishReview', () => {
  it('does not preselect an event and refuses to submit without one', async () => {
    const fetch = vi.fn();
    const { node, submit } = setup(fetch);
    expect(node.querySelectorAll('.triage-finish__event:checked')).toHaveLength(0);
    submit();
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(node.querySelector('.triage-finish__status')?.textContent).toContain('Choose');
  });

  it('submits the chosen event with comments and reports success', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 9, html_url: 'https://gh/9' }),
    });
    const { node, pick, submit, onSubmitted } = setup(fetch as unknown as typeof globalThis.fetch);
    pick('REQUEST_CHANGES');
    submit();
    await flush();

    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.event).toBe('REQUEST_CHANGES');
    expect(body.comments).toEqual([{ path: 'a.ts', line: 1, side: 'RIGHT', body: 'nit' }]);
    expect(onSubmitted).toHaveBeenCalledWith({ id: 9, htmlUrl: 'https://gh/9' });
    expect(node.querySelector('.triage-finish__link')?.getAttribute('href')).toBe('https://gh/9');
  });

  it('keeps the draft and shows a plain error on failure (nothing lost)', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response);
    const { node, pick, submit, onSubmitted } = setup(fetch as unknown as typeof globalThis.fetch);
    pick('APPROVE');
    submit();
    await flush();

    expect(onSubmitted).not.toHaveBeenCalled();
    expect(node.querySelector('.triage-finish__status')?.textContent).toContain('nothing was lost');
    // The submit button is re-enabled so the reviewer can retry.
    expect((node.querySelector('.triage-finish__submit') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('handles an unexpected (non-submit) error gracefully', async () => {
    const onSubmitted = vi.fn();
    const node = createFinishReview(ref, {
      tokens: new InMemoryTokenStore('tok'),
      fetch: vi.fn(),
      getComments: () => {
        throw new Error('boom');
      },
      onSubmitted,
    });
    (node.querySelector('.triage-finish__event[value="COMMENT"]') as HTMLInputElement).checked =
      true;
    (node.querySelector('.triage-finish__submit') as HTMLButtonElement).click();
    await flush();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(node.querySelector('.triage-finish__status')?.textContent).toContain('unknown');
  });
});
