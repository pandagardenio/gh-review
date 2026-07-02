/**
 * Pluggable key-value storage for review drafts (BL-011), analogous to the
 * BL-001 {@link TokenStore} contract. The engine reads/writes drafts only
 * through this interface — never a concrete backend. The bookmarklet supplies a
 * `localStorage` implementation; the extension a `chrome.storage` one. Keeps the
 * engine local-first and backend-free (Constitution principle 6).
 *
 * `keys()` is required so the engine can detect a head-SHA change by finding a
 * prior draft for the same PR under a different key (principle 5 — never
 * silently drop work).
 */
export interface DraftStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** All keys currently present (used to find same-PR drafts across head SHAs). */
  keys(): Promise<string[]>;
}

/** In-memory {@link DraftStorage} for tests and the engine smoke path. */
export class InMemoryDraftStorage implements DraftStorage {
  #map = new Map<string, string>();

  read(key: string): Promise<string | null> {
    return Promise.resolve(this.#map.get(key) ?? null);
  }

  write(key: string, value: string): Promise<void> {
    this.#map.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.#map.delete(key);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.#map.keys()]);
  }
}
