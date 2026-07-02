/**
 * Review materialization (BL-012): submit the accumulated draft as **one**
 * GitHub review via `POST /repos/{owner}/{repo}/pulls/{number}/reviews`.
 *
 * The verdict lands in GitHub's own trust primitive — we are never the system of
 * record (Constitution principle 3). The reviewer always chooses the event
 * (APPROVE / REQUEST_CHANGES / COMMENT); nothing auto-approves (principle 4).
 * This function only performs the POST and throws on failure — clearing or
 * keeping the local draft is the caller's job, so a failed submit loses nothing.
 *
 * `fetch` is injected so tests stub it (no real network), per the engine rules.
 */

import type { PullRequestRef } from '../diff/coordinates.js';
import type { TokenStore } from '../token-store.js';
import type { DraftComment } from './comments.js';

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/** What "Finish review" sends: the chosen event, an optional body, the comments. */
export interface ReviewSubmission {
  readonly event: ReviewEvent;
  readonly body?: string;
  readonly comments: readonly DraftComment[];
}

export interface SubmittedReview {
  readonly id: number;
  readonly htmlUrl: string;
}

export type ReviewSubmitReason = 'missing-token' | 'network' | 'http-error' | 'parse-error';

export class ReviewSubmitError extends Error {
  readonly reason: ReviewSubmitReason;
  readonly status?: number;

  constructor(
    reason: ReviewSubmitReason,
    options: { message?: string; status?: number; cause?: unknown } = {},
  ) {
    super(options.message ?? `Review submission failed (${reason}).`, { cause: options.cause });
    this.name = 'ReviewSubmitError';
    this.reason = reason;
    this.status = options.status;
  }
}

/** Map the draft's overall intent to a GitHub review event (`none` → null). */
export function intentToEvent(intent: string): ReviewEvent | null {
  switch (intent) {
    case 'approve':
      return 'APPROVE';
    case 'request-changes':
      return 'REQUEST_CHANGES';
    case 'comment':
      return 'COMMENT';
    default:
      return null;
  }
}

export interface SubmitReviewOptions {
  readonly tokens: TokenStore;
  readonly fetch?: typeof globalThis.fetch;
  readonly apiBase?: string;
}

const DEFAULT_API_BASE = 'https://api.github.com';

export async function submitReview(
  ref: PullRequestRef,
  submission: ReviewSubmission,
  options: SubmitReviewOptions,
): Promise<SubmittedReview> {
  const token = await options.tokens.get();
  if (!token) throw new ReviewSubmitError('missing-token');

  const doFetch = options.fetch ?? globalThis.fetch;
  const apiBase = options.apiBase ?? DEFAULT_API_BASE;
  const url = `${apiBase}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews`;

  const payload = {
    commit_id: ref.headSha,
    event: submission.event,
    ...(submission.body ? { body: submission.body } : {}),
    comments: submission.comments.map((comment) => ({
      path: comment.path,
      line: comment.line,
      side: comment.side,
      body: comment.body,
    })),
  };

  let response: Response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    throw new ReviewSubmitError('network', { cause });
  }

  if (!response.ok) {
    throw new ReviewSubmitError('http-error', {
      status: response.status,
      message: `GitHub returned ${response.status} submitting the review.`,
    });
  }

  try {
    const review = (await response.json()) as { id: number; html_url: string };
    return { id: review.id, htmlUrl: review.html_url };
  } catch (cause) {
    throw new ReviewSubmitError('parse-error', { cause });
  }
}
