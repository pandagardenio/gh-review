/**
 * Bookmarklet entry shell (BL-013).
 *
 * A thin per-target shell: it wires the provider-agnostic engine and the CSP-safe
 * UI into a floating panel injected on a GitHub PR page. Everything is bundled
 * self-contained (no remote code — CSP-exempt only because it runs from a
 * `javascript:` URL, MVP.md §5.1). The token lives in `localStorage` behind a
 * visible warning; the panel shows its build version.
 *
 * Kept intentionally thin (the engine/ui packages hold the tested logic).
 */

import { loadPullRequestDiff, type PullRequestRef, parsePullRequestUrl } from '@triage/engine';
import {
  createFinishReview,
  createReviewFlow,
  createTokenEntry,
  el,
  LocalStorageTokenStore,
} from '@triage/ui';
import { BOOKMARKLET_VERSION } from './version.js';

const PANEL_ID = 'triage-bookmarklet-panel';

async function resolveHeadSha(
  loc: { owner: string; repo: string; number: number },
  token: string | null,
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${loc.owner}/${loc.repo}/pulls/${loc.number}`,
    { headers },
  );
  const pr = (await res.json()) as { head?: { sha?: string } };
  return pr.head?.sha ?? 'HEAD';
}

function mountPanel(): HTMLElement {
  document.getElementById(PANEL_ID)?.remove();
  const panel = el('aside', {
    attrs: { id: PANEL_ID },
    style: {
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
    },
  });
  document.body.appendChild(panel);
  return panel;
}

async function main(): Promise<void> {
  const loc = parsePullRequestUrl(globalThis.location.href);
  if (!loc) {
    globalThis.alert('Triage: open a GitHub pull request first.');
    return;
  }

  const tokens = new LocalStorageTokenStore();
  const panel = mountPanel();
  const body = el('div');

  const load = el('button', {
    attrs: { type: 'button' },
    text: 'Load review',
    on: {
      click: async () => {
        body.replaceChildren(el('p', { text: 'Loading…' }));
        try {
          const token = await tokens.get();
          const ref: PullRequestRef = { ...loc, headSha: await resolveHeadSha(loc, token) };
          const diff = await loadPullRequestDiff(ref, { tokens });
          const flow = createReviewFlow(diff);
          const finish = createFinishReview(ref, {
            tokens,
            getComments: () => [],
            onSubmitted: () => body.appendChild(el('p', { text: 'Review submitted.' })),
          });
          body.replaceChildren(flow.element, finish);
        } catch (error) {
          body.replaceChildren(el('p', { text: `Failed to load: ${String(error)}` }));
        }
      },
    },
  });

  panel.append(
    el('header', {
      children: [el('strong', { text: 'Triage' }), el('span', { text: ` ${BOOKMARKLET_VERSION}` })],
    }),
    createTokenEntry({ tokens }),
    load,
    body,
  );
}

void main();
