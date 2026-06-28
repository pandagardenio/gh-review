/**
 * Pluggable token storage contract (BL-001).
 *
 * The engine reads a GitHub token through this interface only; it never touches
 * `localStorage`, `chrome.storage`, or any concrete backend. Two implementations
 * land later with their channels: `localStorage` for the bookmarklet, and
 * `chrome.storage` for the extension (CLAUDE.md hard constraints / MVP.md §6).
 *
 * Methods are async so a `chrome.storage`-backed store (which is promise-based)
 * can satisfy the same contract as a synchronous `localStorage`-backed one.
 */
export interface TokenStore {
  /** Resolve the stored token, or `null` when none is set. */
  get(): Promise<string | null>;
  /** Persist a token. */
  set(token: string): Promise<void>;
  /** Remove any stored token. */
  clear(): Promise<void>;
}

/**
 * In-memory {@link TokenStore} — the default used by tests and the engine smoke
 * entry. Real channels supply persistent implementations; nothing in the engine
 * is hardwired to a concrete backend.
 */
export class InMemoryTokenStore implements TokenStore {
  #token: string | null;

  constructor(initial: string | null = null) {
    this.#token = initial;
  }

  get(): Promise<string | null> {
    return Promise.resolve(this.#token);
  }

  set(token: string): Promise<void> {
    this.#token = token;
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#token = null;
    return Promise.resolve();
  }
}
