/**
 * Shared review-app bootstrap (BL-013 / BL-014).
 *
 * Both per-target entry shells — the bookmarklet and the Chrome extension —
 * mount the **same** panel through this one function; only the injected
 * {@link TokenStore} and version differ (localStorage vs `chrome.storage`). That
 * is what makes the flows identical (BL-014 acceptance / MVP.md §5.3).
 *
 * The engine stays host-agnostic; this UI layer wires `loadPullRequestDiff` →
 * `createReviewFlow` → `createFinishReview`. CSP-safe throughout ({@link el});
 * the panel is positioned via CSSOM, never a `style=` attribute.
 */

import type { TokenStore } from '@triage/engine';
import { loadPullRequestDiff, type PullRequestLocator, parsePullRequestUrl } from '@triage/engine';
import { el } from './dom.js';
import { createFinishReview } from './finish-review.js';
import { createReviewFlow } from './review-flow.js';
import { createTokenEntry } from './token-entry.js';

export interface ReviewAppOptions {
  tokens: TokenStore;
  /** Build version shown in the panel header. */
  version: string;
  /** Page URL to derive PR coordinates from. Defaults to `location.href`. */
  location?: string;
  /** Injected `fetch` (tests / host). Defaults to the global. */
  fetch?: typeof globalThis.fetch;
}

/** Build the floating review panel. The caller appends it to the document. */
export function createReviewApp(options: ReviewAppOptions): HTMLElement {
  const panel = el('aside', { class: 'triage-app', attrs: { 'aria-label': 'Triage' } });
  positionPanel(panel);

  const loc = parsePullRequestUrl(options.location ?? globalThis.location.href);
  if (!loc) {
    panel.append(
      el('p', {
        class: 'triage-app__empty',
        text: 'Open a GitHub pull request to start a review.',
      }),
    );
    return panel;
  }

  const body = el('div', { class: 'triage-app__body' });
  const load = el('button', {
    class: 'triage-app__load',
    attrs: { type: 'button' },
    text: 'Load review',
    on: { click: () => void loadReview(loc, options, body) },
  });

  panel.append(
    el('header', {
      class: 'triage-app__head',
      children: [el('strong', { text: 'Triage' }), el('span', { text: ` ${options.version}` })],
    }),
    createTokenEntry({ tokens: options.tokens }),
    load,
    body,
  );
  return panel;
}

async function loadReview(
  loc: PullRequestLocator,
  options: ReviewAppOptions,
  body: HTMLElement,
): Promise<void> {
  const doFetch = options.fetch ?? globalThis.fetch;
  body.replaceChildren(el('p', { text: 'Loading…' }));
  try {
    const token = await options.tokens.get();
    const headSha = await resolveHeadSha(loc, token, doFetch);
    const ref = { ...loc, headSha };
    const diff = await loadPullRequestDiff(ref, { tokens: options.tokens, fetch: doFetch });
    const flow = createReviewFlow(diff);
    const finish = createFinishReview(ref, {
      tokens: options.tokens,
      fetch: doFetch,
      getComments: () => [],
      onSubmitted: () => undefined,
    });
    body.replaceChildren(flow.element, finish);
  } catch (error) {
    body.replaceChildren(
      el('p', { class: 'triage-app__error', text: `Failed to load: ${String(error)}` }),
    );
  }
}

/** Head SHA from the REST API — needed to key the review draft (BL-011). */
async function resolveHeadSha(
  loc: PullRequestLocator,
  token: string | null,
  doFetch: typeof globalThis.fetch,
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await doFetch(
    `https://api.github.com/repos/${loc.owner}/${loc.repo}/pulls/${loc.number}`,
    { headers },
  );
  const pr = (await res.json()) as { head?: { sha?: string } };
  return pr.head?.sha ?? 'HEAD';
}

function positionPanel(panel: HTMLElement): void {
  Object.assign(panel.style, {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: '2147483647',
    width: '28rem',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '1rem',
    background: 'Canvas',
    color: 'CanvasText',
    border: '1px solid GrayText',
    borderRadius: '0.5rem',
    font: '13px system-ui',
  } satisfies Partial<CSSStyleDeclaration>);
}
