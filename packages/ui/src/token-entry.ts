/**
 * Token entry with a storage warning (BL-013).
 *
 * The bookmarklet keeps its GitHub token in `localStorage`, which any script on
 * the page can read — so the entry surface carries a **clear, visible warning**
 * and minimal-scope guidance right where the token is entered (MVP.md §7).
 * CSP-safe ({@link el}); the input is a password field so the token isn't shown.
 */

import type { TokenStore } from '@triage/engine';
import { el } from './dom.js';

export interface TokenEntryOptions {
  tokens: TokenStore;
  /** Called after the token is saved (e.g. to enable "Load review"). */
  onSaved?: (token: string) => void;
}

const WARNING =
  'Stored in this page’s localStorage, readable by any script on github.com. Use a fine-grained token with the least scope needed (read + pull-request write) and revoke it when done.';

/** Build the token-entry panel with its storage warning. */
export function createTokenEntry(options: TokenEntryOptions): HTMLElement {
  const input = el('input', {
    class: 'triage-token__input',
    attrs: { type: 'password', placeholder: 'ghp_… or github_pat_…', 'aria-label': 'GitHub token' },
  });

  const status = el('span', { class: 'triage-token__status', attrs: { role: 'status' } });

  const save = el('button', {
    class: 'triage-token__save',
    attrs: { type: 'button' },
    text: 'Save token',
    on: {
      click: async () => {
        const token = input.value.trim();
        if (!token) {
          status.textContent = 'Enter a token first.';
          return;
        }
        await options.tokens.set(token);
        status.textContent = 'Token saved.';
        options.onSaved?.(token);
      },
    },
  });

  return el('div', {
    class: 'triage-token',
    children: [
      el('label', { class: 'triage-token__label', text: 'GitHub token' }),
      input,
      save,
      status,
      el('p', { class: 'triage-token__warning', attrs: { role: 'note' }, text: WARNING }),
    ],
  });
}
