/**
 * Pull-request coordinates (BL-002).
 *
 * `owner`, `repo` and `number` are derivable from the page URL; `headSha` is
 * page *context* the entry shell supplies (it keys local-first draft state —
 * CLAUDE.md). The engine stays DOM-agnostic: it parses a URL string, it never
 * reads the page.
 */

/** Everything the loader needs to address a pull request. */
export interface PullRequestRef {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  /** Head commit SHA — supplied by the entry shell from page context. */
  readonly headSha: string;
}

/** The URL-derivable subset of {@link PullRequestRef}. */
export type PullRequestLocator = Omit<PullRequestRef, 'headSha'>;

// `/{owner}/{repo}/pull/{number}` — optionally trailed by `/files`, `.diff`, etc.
const PULL_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/.]|$)/;

/**
 * Extract `{ owner, repo, number }` from a GitHub PR URL or path, or `null`
 * when it is not a pull-request location. Accepts a full URL or a bare pathname
 * so the same helper serves the bookmarklet (`location.href`) and tests.
 */
export function parsePullRequestUrl(urlOrPath: string): PullRequestLocator | null {
  const pathname = toPathname(urlOrPath);
  const match = PULL_PATH.exec(pathname);
  if (!match) return null;
  const [, owner = '', repo = '', number = '0'] = match;
  return { owner, repo, number: Number(number) };
}

function toPathname(urlOrPath: string): string {
  try {
    // Absolute URL → its pathname; bare path → URL() throws and we use it as-is.
    return new URL(urlOrPath).pathname;
  } catch {
    return urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }
}
