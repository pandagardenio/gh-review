/**
 * A tiny GitHub REST client for the baseline fleet source (BL-025): conditional,
 * cached, paginated GETs with plain error classification. Environment-agnostic —
 * global `fetch`, no DOM — so it runs in the CLI (node) and the web app (browser).
 * The `fetch` boundary is injected so tests stub it (no live network in CI).
 */

import type { TokenStore } from '@triage/engine';
import type { ConditionalCache } from './cache.js';
import { InMemoryConditionalCache } from './cache.js';

const DEFAULT_API_BASE = 'https://api.github.com';
const MAX_PAGES = 20; // 20 × 100 — a generous windowed bound, not a silent small-repo cap.

/** How a repo request failed — enough to render a plain, non-misleading error. */
export type GitHubErrorKind = 'unauthorized' | 'not-found' | 'rate-limited' | 'network' | 'unknown';

export class GitHubApiError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GitHubApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export interface GitHubClientOptions {
  readonly tokens: TokenStore;
  readonly fetch?: typeof globalThis.fetch;
  readonly apiBase?: string;
  readonly cache?: ConditionalCache;
}

export interface GetPagedOptions<T> {
  /**
   * Called with each fetched page; return true to stop paginating. Lets a caller
   * bound a sorted resource to a window (e.g. stop once past the window's start)
   * instead of pulling every page and filtering after.
   */
  readonly stopWhen?: (page: T[]) => boolean;
}

export class GitHubClient {
  readonly #tokens: TokenStore;
  readonly #fetch: typeof globalThis.fetch;
  readonly #apiBase: string;
  readonly #cache: ConditionalCache;

  constructor(options: GitHubClientOptions) {
    this.#tokens = options.tokens;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#apiBase = options.apiBase ?? DEFAULT_API_BASE;
    this.#cache = options.cache ?? new InMemoryConditionalCache();
  }

  /**
   * GET every page of an array resource. A conditional request on the first page
   * (`If-None-Match` from the cache) short-circuits to the cached assembly on 304.
   * Throws a {@link GitHubApiError} classified by cause; never a hot retry loop.
   */
  async getPaged<T>(path: string, options: GetPagedOptions<T> = {}): Promise<T[]> {
    const url = `${this.#apiBase}${path}`;
    const firstHeaders = await this.#headers();
    const cached = await this.#cache.get(url);
    if (cached) firstHeaders['If-None-Match'] = cached.etag;

    const response = await this.#send(url, firstHeaders);
    if (response.status === 304 && cached) return JSON.parse(cached.body) as T[];
    throwIfError(response);

    const firstPage = await parseJson<T[]>(response);
    const collected = firstPage.slice();
    let next = nextLink(response.headers.get('Link'));
    const multiPage = next !== null;

    // Pages 2..N must NOT carry page 1's ETag, or a coincidental match could 304 a
    // later page out of the assembly.
    const pageHeaders = { ...firstHeaders };
    delete pageHeaders['If-None-Match'];
    let stopped = options.stopWhen?.(firstPage) ?? false;
    for (let page = 1; next && !stopped && page < MAX_PAGES; page++) {
      const pageResponse = await this.#send(next, pageHeaders);
      throwIfError(pageResponse);
      const items = await parseJson<T[]>(pageResponse);
      collected.push(...items);
      next = nextLink(pageResponse.headers.get('Link'));
      stopped = options.stopWhen?.(items) ?? false;
    }

    // Only single-page resources are cached: a page-1 ETag can't vouch that later
    // pages are unchanged, so a 304 on it must never stand in for the whole assembly.
    const etag = response.headers.get('ETag');
    if (etag && !multiPage) await this.#cache.set(url, { etag, body: JSON.stringify(collected) });
    return collected;
  }

  /** GET a single object resource (no pagination, no conditional cache). */
  async getOne<T>(path: string): Promise<T> {
    const response = await this.#send(`${this.#apiBase}${path}`, await this.#headers());
    throwIfError(response);
    return parseJson<T>(response);
  }

  /**
   * GET a resource as raw text (e.g. a file via the contents API with the `raw`
   * media type) — env-agnostic, avoids base64 decoding. Throws the same classified
   * errors; a `not-found` is how a missing ledger branch/file surfaces.
   */
  async getRaw(path: string): Promise<string> {
    const url = `${this.#apiBase}${path}`;
    const headers = await this.#headers();
    headers.Accept = 'application/vnd.github.raw+json';
    const cached = await this.#cache.get(url);
    if (cached) headers['If-None-Match'] = cached.etag;

    const response = await this.#send(url, headers);
    if (response.status === 304 && cached) return cached.body;
    throwIfError(response);

    const body = await response.text();
    const etag = response.headers.get('ETag');
    if (etag) await this.#cache.set(url, { etag, body });
    return body;
  }

  async #headers(): Promise<Record<string, string>> {
    const token = await this.#tokens.get();
    if (!token) throw new GitHubApiError('unauthorized', 'no GitHub token configured');
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async #send(url: string, headers: Record<string, string>): Promise<Response> {
    try {
      return await this.#fetch(url, { headers });
    } catch (cause) {
      throw new GitHubApiError('network', `request to ${url} failed`, { cause });
    }
  }
}

function throwIfError(response: Response): void {
  if (response.ok || response.status === 304) return;
  const status = response.status;
  if (status === 401) throw new GitHubApiError('unauthorized', 'bad or missing token', { status });
  if (status === 404) {
    throw new GitHubApiError('not-found', 'repository not found or no access', { status });
  }
  if (status === 403 || status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    if (status === 429 || remaining === '0' || retryAfter !== null) {
      throw new GitHubApiError('rate-limited', 'rate limited by GitHub', {
        status,
        ...(retryAfter !== null ? { retryAfterSeconds: retryAfter } : {}),
      });
    }
    throw new GitHubApiError('unauthorized', 'forbidden', { status });
  }
  throw new GitHubApiError('unknown', `GitHub returned ${status}`, { status });
}

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new GitHubApiError('unknown', 'malformed JSON from GitHub', { cause });
  }
}

/** Parse a `Retry-After` header (delta-seconds only; an HTTP-date returns null). */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

/** Extract the `rel="next"` URL from a REST `Link` header, or `null`. */
function nextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}
