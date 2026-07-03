/**
 * `chrome.storage`-backed {@link TokenStore} (BL-014).
 *
 * The extension's content script runs in the **isolated world**, and the token
 * lives in `chrome.storage` — outside any page-reachable storage. This is the
 * real fix for the bookmarklet's `localStorage` exposure (MVP.md §5.3,
 * Constitution principle 5). Same BL-001 contract, different backend, so the
 * review flow is otherwise identical.
 */

import type { TokenStore } from '@triage/engine';

const KEY = 'triage:token';

export class ChromeStorageTokenStore implements TokenStore {
  readonly #area: chrome.storage.StorageArea;

  constructor(area: chrome.storage.StorageArea = chrome.storage.local) {
    this.#area = area;
  }

  async get(): Promise<string | null> {
    const result = await this.#area.get(KEY);
    const token = result[KEY];
    return typeof token === 'string' ? token : null;
  }

  async set(token: string): Promise<void> {
    await this.#area.set({ [KEY]: token });
  }

  async clear(): Promise<void> {
    await this.#area.remove(KEY);
  }
}
