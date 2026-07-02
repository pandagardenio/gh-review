/**
 * `localStorage`-backed {@link DraftStorage} (BL-011) — the bookmarklet's draft
 * persistence backend (the extension uses `chrome.storage` instead). Local-first,
 * no backend (Constitution principle 6).
 *
 * `keys()` returns only Triage's own keys so head-SHA detection never scans
 * unrelated page storage.
 */

import type { DraftStorage } from '@triage/engine';

const OWN_KEY_PREFIX = 'triage:review:';

export class LocalStorageDraftStorage implements DraftStorage {
  readonly #storage: Storage;

  constructor(storage: Storage = globalThis.localStorage) {
    this.#storage = storage;
  }

  read(key: string): Promise<string | null> {
    return Promise.resolve(this.#storage.getItem(key));
  }

  write(key: string, value: string): Promise<void> {
    this.#storage.setItem(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.#storage.removeItem(key);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i);
      if (key?.startsWith(OWN_KEY_PREFIX)) keys.push(key);
    }
    return Promise.resolve(keys);
  }
}
