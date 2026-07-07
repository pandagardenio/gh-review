/**
 * Map raw GitHub REST JSON onto the baseline-tier fleet records (BL-025). Kept
 * separate from the client so the wire shapes live in one place.
 *
 * A documented v1 budget trade-off: the list endpoints omit per-item size stats
 * (`additions`/`deletions` appear only on the single-resource GET), so commit and
 * PR sizes map to `null` here rather than spending a request per item. Downstream
 * treats null sizes as "excluded" (BL-022), never zero — so PR-share and CI-health
 * are exact on live data while line-share awaits an opt-in size-enrichment pass.
 */

import type {
  CheckConclusion,
  CheckRecord,
  CommitRecord,
  PullRecord,
  PullState,
  ReviewState,
} from '../model/github.js';

export interface RawCommit {
  readonly sha: string;
  readonly commit: { readonly message: string; readonly committer?: { readonly date?: string } };
  readonly author?: { readonly login?: string } | null;
}

export interface RawPull {
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly state: string;
  readonly merged_at: string | null;
  readonly created_at: string;
  readonly head: { readonly sha: string; readonly ref: string };
  readonly user?: { readonly login?: string } | null;
}

export interface RawReview {
  readonly state: string;
}

export interface RawCheckRun {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

const REVIEW_STATES: Record<string, ReviewState> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  COMMENTED: 'commented',
  DISMISSED: 'dismissed',
};

const CHECK_CONCLUSIONS: Record<string, CheckConclusion> = {
  success: 'success',
  failure: 'failure',
  neutral: 'neutral',
  cancelled: 'cancelled',
  timed_out: 'timed_out',
  action_required: 'action_required',
  skipped: 'neutral', // deliberately skipped — not a failure, not a green signal
  stale: 'failure', // result no longer trustworthy — do not count as passing
  startup_failure: 'failure', // the workflow never started — a genuine failure
};

export function mapCommit(repo: string, raw: RawCommit): CommitRecord {
  return {
    sha: raw.sha,
    repo,
    message: raw.commit.message,
    authorLogin: raw.author?.login ?? null,
    committedAt: raw.commit.committer?.date ?? '',
    additions: null,
    deletions: null,
  };
}

export function mapPull(
  repo: string,
  raw: RawPull,
  reviewStates: readonly ReviewState[],
): PullRecord {
  const state: PullState = raw.merged_at ? 'merged' : raw.state === 'open' ? 'open' : 'closed';
  return {
    number: raw.number,
    repo,
    title: raw.title,
    url: raw.html_url,
    state,
    headSha: raw.head.sha,
    // v1: the current head only. Force-push history would need /pulls/{n}/commits.
    headShas: [raw.head.sha],
    branch: raw.head.ref,
    authorLogin: raw.user?.login ?? null,
    createdAt: raw.created_at,
    mergedAt: raw.merged_at,
    additions: null,
    deletions: null,
    reviewStates,
  };
}

/** Map the distinct review states a PR received (GitHub returns one row per review). */
export function mapReviewStates(raws: readonly RawReview[]): ReviewState[] {
  const out: ReviewState[] = [];
  for (const raw of raws) {
    const state = REVIEW_STATES[raw.state];
    if (state && !out.includes(state)) out.push(state);
  }
  return out;
}

export function mapCheckRun(repo: string, headSha: string, raw: RawCheckRun): CheckRecord {
  // An unrecognized *completed* conclusion maps to `failure`, never `neutral`:
  // downstream scores `neutral` as green, so an unknown must not silently pass.
  const conclusion: CheckConclusion =
    raw.status !== 'completed' ? 'pending' : (CHECK_CONCLUSIONS[raw.conclusion ?? ''] ?? 'failure');
  return {
    repo,
    headSha,
    name: raw.name,
    conclusion,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
  };
}
