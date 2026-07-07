/**
 * Baseline-tier inputs: the slices of GitHub the metric roll-ups consume
 * (BL-022 provenance, BL-023 CI health, BL-024 harness health). Populated from
 * the REST API by the baseline source (BL-025); mirrored in fixtures.
 *
 * `authorLogin` is a *classification input* (bot-vs-human, `*[bot]`), never an
 * aggregation key — no metric groups by it (CONTROL-ROOM-CONSTITUTION.md
 * principle 1). Provenance rolls up by agent identity or the anonymous "human"
 * bucket only.
 */

export interface CommitRecord {
  readonly sha: string;
  readonly repo: string;
  /** Full commit message, so BL-022 can read `Co-Authored-By` trailers. */
  readonly message: string;
  /** Author login — for `*[bot]` detection only; not an aggregation key. */
  readonly authorLogin: string | null;
  readonly committedAt: string;
  /** Lines added; null when the API omits per-commit stats (large repos). */
  readonly additions: number | null;
  /** Lines removed; null when the API omits per-commit stats. */
  readonly deletions: number | null;
}

export type PullState = 'open' | 'closed' | 'merged';

/** PR review outcomes, for the review-escalation signal (BL-024). */
export type ReviewState = 'approved' | 'changes_requested' | 'commented' | 'dismissed';

export interface PullRecord {
  readonly number: number;
  readonly repo: string;
  readonly title: string;
  readonly url: string;
  readonly state: PullState;
  /** Head commit SHA — CI health is computed per head (BL-023). */
  readonly headSha: string;
  /** Head branch ref, for branch-prefix classification (BL-022). */
  readonly branch: string | null;
  /** Author login — for `*[bot]` detection only; not an aggregation key. */
  readonly authorLogin: string | null;
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  /** Review states this PR received, for the escalation rate (BL-024). */
  readonly reviewStates: readonly ReviewState[];
}

/** Terminal check conclusions plus `pending` for a check still in flight. */
export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | 'pending';

export interface CheckRecord {
  readonly repo: string;
  /** The commit this check ran against — health is per head SHA (BL-023). */
  readonly headSha: string;
  readonly name: string;
  readonly conclusion: CheckConclusion;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}
