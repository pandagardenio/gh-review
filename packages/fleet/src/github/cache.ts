/**
 * Conditional-request cache for {@link GitHubClient} (BL-025). Stores an ETag and
 * the assembled response body per URL so a refresh can send `If-None-Match` and be
 * served a `304 Not Modified` — the core of the rate-limit discipline for a 40-repo
 * fleet (a 304 does not count against the primary rate limit).
 *
 * The interface is pluggable and async-tolerant so an app can back it with
 * `localStorage` (browser) or a file (CLI); the engine's `TokenStore` sets the
 * precedent. The default here is in-memory, for a single process run and for tests.
 */

export interface CachedResponse {
  readonly etag: string;
  /** JSON-serialized assembled payload (all pages of a list resource). */
  readonly body: string;
}

export interface ConditionalCache {
  get(key: string): CachedResponse | undefined | Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse): void | Promise<void>;
}

/** In-memory {@link ConditionalCache} — the default; also the test fake. */
export class InMemoryConditionalCache implements ConditionalCache {
  readonly #store = new Map<string, CachedResponse>();

  get(key: string): CachedResponse | undefined {
    return this.#store.get(key);
  }

  set(key: string, value: CachedResponse): void {
    this.#store.set(key, value);
  }
}
