/**
 * Pull-request diff loader (BL-002).
 *
 * Strategy, in order (CLAUDE.md hard constraints / MVP.md §6):
 *   1. **Fast path** — same-origin `/{owner}/{repo}/pull/{n}.diff`, no token.
 *   2. **Fallback** — REST `/repos/{owner}/{repo}/pulls/{n}/files` with a token
 *      from the {@link TokenStore}, paginated via the `Link` header.
 *
 * A fast-path failure (a thrown `fetch`, i.e. a CSP-blocked cross-origin
 * redirect on a private PR) silently triggers the fallback — it is *never*
 * surfaced as "PR too large". Only when the fallback also fails do we throw,
 * with a {@link DiffLoadError} carrying the precise reason.
 *
 * The `fetch` boundary is injected so tests stub it (no real network) per the
 * engine testing rules.
 */

import type { TokenStore } from '../token-store.js';
import { type ApiPullRequestFile, mapApiFiles } from './api-files.js';
import type { PullRequestRef } from './coordinates.js';
import { DiffLoadError } from './errors.js';
import type { PullRequestDiff } from './model.js';
import { parseUnifiedDiff } from './unified-diff.js';

export interface LoadDiffOptions {
  /** Token source for the API fallback (BL-001 contract). */
  readonly tokens: TokenStore;
  /** Injected `fetch`; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
  /** Same-origin base for the `.diff` fast path. Defaults to GitHub. */
  readonly origin?: string;
  /** REST API base. Defaults to `https://api.github.com`. */
  readonly apiBase?: string;
}

const DEFAULT_ORIGIN = 'https://github.com';
const DEFAULT_API_BASE = 'https://api.github.com';
const MAX_PAGES = 30; // 30 × 100 files — a generous bound, not a silent cap on small PRs.

export async function loadPullRequestDiff(
  ref: PullRequestRef,
  options: LoadDiffOptions,
): Promise<PullRequestDiff> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;

  const files =
    (await tryFastPath(ref, doFetch, origin)) ??
    (await loadFromApi(ref, doFetch, apiBase, options.tokens));

  return { owner: ref.owner, repo: ref.repo, number: ref.number, headSha: ref.headSha, files };
}

/** `.diff` fast path. Returns `null` (→ fall back) on any failure; never throws. */
async function tryFastPath(
  ref: PullRequestRef,
  doFetch: typeof globalThis.fetch,
  origin: string,
): Promise<PullRequestDiff['files'] | null> {
  const url = `${origin}/${ref.owner}/${ref.repo}/pull/${ref.number}.diff`;
  let response: Response;
  try {
    response = await doFetch(url, { headers: { Accept: 'text/plain' } });
  } catch {
    // Thrown fetch = CSP-blocked cross-origin redirect (private PR). Fall back —
    // explicitly NOT "PR too large" (the bug from MVP.md §6).
    return null;
  }
  if (!response.ok) return null;
  try {
    return parseUnifiedDiff(await response.text());
  } catch {
    return null;
  }
}

/** REST `/pulls/{n}/files` fallback — requires a token, follows `Link` pagination. */
async function loadFromApi(
  ref: PullRequestRef,
  doFetch: typeof globalThis.fetch,
  apiBase: string,
  tokens: TokenStore,
): Promise<PullRequestDiff['files']> {
  const token = await tokens.get();
  if (!token) throw new DiffLoadError('missing-token');

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const collected: ApiPullRequestFile[] = [];
  let next: string | null =
    `${apiBase}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/files?per_page=100`;

  for (let page = 0; next && page < MAX_PAGES; page++) {
    let response: Response;
    try {
      response = await doFetch(next, { headers });
    } catch (cause) {
      throw new DiffLoadError('network', { cause });
    }
    if (!response.ok) {
      throw new DiffLoadError('http-error', {
        status: response.status,
        message: `GitHub API returned ${response.status} loading PR files.`,
      });
    }
    let payload: ApiPullRequestFile[];
    try {
      payload = (await response.json()) as ApiPullRequestFile[];
    } catch (cause) {
      throw new DiffLoadError('parse-error', { cause });
    }
    collected.push(...payload);
    next = nextLink(response.headers.get('Link'));
  }

  return mapApiFiles(collected);
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
