/**
 * Diff-load failure taxonomy (BL-002).
 *
 * The whole point of this type is the bug we already got bitten by (CLAUDE.md
 * hard constraints / MVP.md §6): a `.diff` failure is a CSP-blocked cross-origin
 * redirect on a private PR — **not** "PR too large". Every failure carries a
 * machine-readable {@link DiffLoadReason} so a caller can surface the *right*
 * message and never conflate these cases.
 */

export type DiffLoadReason =
  /**
   * Same-origin `.diff` `fetch` threw (typically "Failed to fetch"): GitHub
   * served a cross-origin 302 to a private-PR diff host and CSP `connect-src`
   * blocked following it. The signal to fall back to the API — never "too large".
   */
  | 'csp-blocked-redirect'
  /** A real network failure (offline, DNS, connection reset) on the API path. */
  | 'network'
  /** The API fallback needs a token and the {@link TokenStore} had none. */
  | 'missing-token'
  /** The server answered with a non-OK HTTP status. */
  | 'http-error'
  /** Bytes were fetched but could not be parsed into the diff model. */
  | 'parse-error';

/** Human-readable defaults, kept out of the throw sites for one source of truth. */
const REASON_MESSAGES: Record<DiffLoadReason, string> = {
  'csp-blocked-redirect':
    "Couldn't load the .diff (CSP blocked a cross-origin redirect — typical of a private PR); falling back to the API.",
  network: 'Network error while loading the pull request diff.',
  'missing-token':
    'The .diff path is unavailable and the API fallback needs a GitHub token. Add one to continue.',
  'http-error': 'GitHub returned an error while loading the pull request diff.',
  'parse-error': 'The pull request diff could not be parsed.',
};

/** A diff-load failure tagged with a {@link DiffLoadReason}. */
export class DiffLoadError extends Error {
  readonly reason: DiffLoadReason;
  /** HTTP status when {@link reason} is `http-error`. */
  readonly status?: number;

  constructor(
    reason: DiffLoadReason,
    options: { message?: string; status?: number; cause?: unknown } = {},
  ) {
    super(options.message ?? REASON_MESSAGES[reason], { cause: options.cause });
    this.name = 'DiffLoadError';
    this.reason = reason;
    this.status = options.status;
  }
}
