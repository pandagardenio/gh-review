/**
 * Head-SHA change notice (BL-011): when a saved draft was authored against an
 * older commit, surface it **non-destructively** and let the reviewer keep or
 * discard the draft — never silently drop work (Constitution principle 5).
 * Remapping onto the new commits is out of scope (MVP.md §7). CSP-safe ({@link el}).
 */

import { el } from './dom.js';

export interface HeadShaNoticeOptions {
  /** Keep the stale draft (restore its content under the current head). */
  onKeep: () => void;
  /** Discard the stale draft. */
  onDiscard: () => void;
}

/** Build the "this PR has new commits since your draft" notice. */
export function createHeadShaNotice(
  savedHeadSha: string,
  currentHeadSha: string,
  options: HeadShaNoticeOptions,
): HTMLElement {
  const shortSaved = savedHeadSha.slice(0, 7);
  const shortCurrent = currentHeadSha.slice(0, 7);
  return el('div', {
    class: 'triage-headsha-notice',
    attrs: { role: 'alert' },
    children: [
      el('p', {
        class: 'triage-headsha-notice__text',
        text: `This PR has new commits since your draft (saved at ${shortSaved}, now ${shortCurrent}). Your draft is kept — line positions may no longer match.`,
      }),
      el('button', {
        class: 'triage-headsha-notice__keep',
        attrs: { type: 'button' },
        text: 'Keep draft',
        on: { click: options.onKeep },
      }),
      el('button', {
        class: 'triage-headsha-notice__discard',
        attrs: { type: 'button' },
        text: 'Discard draft',
        on: { click: options.onDiscard },
      }),
    ],
  });
}
