/**
 * `localStorage`-backed {@link TokenStore} (BL-013) — the bookmarklet's token
 * backend. The extension uses `chrome.storage` instead (BL-014), which keeps the
 * token out of page-reachable storage; this implementation deliberately does not,
 * so it ships with a visible warning (see `createTokenEntry`) about page
 * readability and minimal-scope guidance (MVP.md §7).
 */

import type { TokenStore } from '@triage/engine';

const DEFAULT_KEY = 'triage:token';

export class LocalStorageTokenStore implements TokenStore {
  readonly #storage: Storage;
  readonly #key: string;

  constructor(options: { storage?: Storage; key?: string } = {}) {
    this.#storage = options.storage ?? globalThis.localStorage;
    this.#key = options.key ?? DEFAULT_KEY;
  }

  get(): Promise<string | null> {
    return Promise.resolve(this.#storage.getItem(this.#key));
  }

  set(token: string): Promise<void> {
    this.#storage.setItem(this.#key, token);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#storage.removeItem(this.#key);
    return Promise.resolve();
  }
}
