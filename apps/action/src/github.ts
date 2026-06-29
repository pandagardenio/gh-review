/**
 * Thin GitHub REST client for the autoreview action: list a PR's files, and
 * submit (or withhold) a review. All I/O lives here so the decision logic stays
 * pure in the engine.
 *
 * Two robustness behaviours matter (principle 5 — never silently mislead):
 *  - **Idempotent.** Re-running on the same head never spams duplicate reviews.
 *  - **No stale approval.** If a PR that we approved later gains review-required
 *    changes, we dismiss our own prior approval before deferring to a human.
 */

import type { ApiPullRequestFile, AutoReviewDecision } from '@triage/engine';
import { MARKER } from './summary.js';

interface Review {
  readonly id: number;
  readonly body: string;
  readonly state: string;
  readonly commit_id: string;
}

export type SubmitResult =
  | { readonly kind: 'approved' }
  | { readonly kind: 'approve-skipped-existing' }
  | { readonly kind: 'self-approve-fallback-comment' }
  | { readonly kind: 'review-required-commented'; readonly dismissed: number }
  | { readonly kind: 'review-required-skipped'; readonly dismissed: number };

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(`GitHub API ${status}: ${bodyText}`);
  }
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly owner: string,
    private readonly repo: string,
    private readonly apiBase = 'https://api.github.com',
  ) {}

  async listPullRequestFiles(pr: number): Promise<ApiPullRequestFile[]> {
    return this.paginate<ApiPullRequestFile>(`/pulls/${pr}/files`);
  }

  /** Apply the decision to the PR, idempotently. Returns what it actually did. */
  async submitDecision(
    pr: number,
    headSha: string,
    decision: AutoReviewDecision,
    body: string,
  ): Promise<SubmitResult> {
    const ours = (await this.paginate<Review>(`/pulls/${pr}/reviews`)).filter((review) =>
      review.body?.includes(MARKER),
    );

    if (decision.outcome === 'approve') return this.approve(pr, headSha, body, ours);
    return this.requireHuman(pr, body, ours);
  }

  private async approve(
    pr: number,
    headSha: string,
    body: string,
    ours: readonly Review[],
  ): Promise<SubmitResult> {
    const current = ours.some((r) => r.state === 'APPROVED' && r.commit_id === headSha);
    if (current) return { kind: 'approve-skipped-existing' };

    try {
      await this.createReview(pr, 'APPROVE', body);
      return { kind: 'approved' };
    } catch (error) {
      // The bot cannot approve a PR it authored — fall back to a plain comment.
      if (error instanceof HttpError && /your own pull request/i.test(error.bodyText)) {
        await this.createReview(pr, 'COMMENT', body);
        return { kind: 'self-approve-fallback-comment' };
      }
      throw error;
    }
  }

  private async requireHuman(
    pr: number,
    body: string,
    ours: readonly Review[],
  ): Promise<SubmitResult> {
    let dismissed = 0;
    for (const review of ours) {
      if (review.state === 'APPROVED') {
        await this.dismissReview(
          pr,
          review.id,
          'Review-required changes appeared; deferring to a human.',
        );
        dismissed += 1;
      }
    }

    const alreadyCommented = ours.some((r) => r.state === 'COMMENTED' && r.body === body);
    if (alreadyCommented && dismissed === 0) return { kind: 'review-required-skipped', dismissed };

    await this.createReview(pr, 'COMMENT', body);
    return { kind: 'review-required-commented', dismissed };
  }

  private createReview(pr: number, event: 'APPROVE' | 'COMMENT', body: string): Promise<unknown> {
    return this.api(`/pulls/${pr}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ event, body }),
    });
  }

  private dismissReview(pr: number, reviewId: number, message: string): Promise<unknown> {
    return this.api(`/pulls/${pr}/reviews/${reviewId}/dismissals`, {
      method: 'PUT',
      body: JSON.stringify({ message, event: 'DISMISS' }),
    });
  }

  private async paginate<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    for (let page = 1; ; page += 1) {
      const sep = path.includes('?') ? '&' : '?';
      const batch = (await this.api(`${path}${sep}per_page=100&page=${page}`)) as T[];
      results.push(...batch);
      if (batch.length < 100) return results;
    }
  }

  private async api(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'triage-autoreview',
        ...init.headers,
      },
    });
    if (!response.ok) throw new HttpError(response.status, await response.text());
    return response.status === 204 ? null : response.json();
  }
}
