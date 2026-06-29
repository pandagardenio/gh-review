/**
 * Autoreview policy model (BL-016).
 *
 * The autoreview surface is a **separate, opt-in CI tool**, not the browser
 * plugin. The plugin never approves (Constitution principle 4); this CI action
 * deliberately strains that principle and the "not a CI gate" non-goal, with the
 * written justification recorded in CONSTITUTION.md (§ "A note on the autoreview
 * action") and MVP.md §9. The strain is bounded: the bot only ever approves the
 * **null case** — a PR with no changes in a review-required category — and only
 * when the configured policy permits it. Anything intent/risk-bearing still
 * routes to a human.
 *
 * This module is pure engine logic (no I/O, no GitHub, no DOM): it maps a
 * categorized diff + a policy onto a decision. The `apps/action` entry shell does
 * the GitHub I/O around it.
 */

import type { CategoryId } from '../categorize/model.js';

/**
 * What to do with the "no review-required files" case. Deliberately a small,
 * extensible set — the user picks the team's risk appetite (this grows in
 * complexity over time):
 *
 * - `auto`     — approve whenever nothing review-required changed.
 * - `never`    — never auto-approve; always leave it to a human.
 * - `threshold`— approve only when nothing review-required changed *and* the PR
 *                stays at or under {@link ThresholdPolicy.maxFiles} total files
 *                (bounds a large code-only diff from sailing through).
 */
export type AutoReviewMode = 'auto' | 'never' | 'threshold';

export interface AutoPolicy {
  readonly mode: 'auto';
}

export interface NeverPolicy {
  readonly mode: 'never';
}

export interface ThresholdPolicy {
  readonly mode: 'threshold';
  /** Max total changed files that can still auto-approve. Integer >= 0. */
  readonly maxFiles: number;
}

/** The configured auto-approval policy. A discriminated union, built to grow. */
export type AutoApprovalPolicy = AutoPolicy | NeverPolicy | ThresholdPolicy;

/** Either the bot approves, or it defers to a human. It never requests changes. */
export type AutoReviewOutcome = 'approve' | 'review-required';

/** The verdict for one PR: what to do, why, and the evidence behind it. */
export interface AutoReviewDecision {
  readonly outcome: AutoReviewOutcome;
  /** One-line, human-readable rationale (surfaced in the review body + logs). */
  readonly reason: string;
  /** Review-required categories that were actually touched (empty ⇒ null case). */
  readonly relevantCategories: readonly CategoryId[];
  /** Files counted across {@link relevantCategories}. */
  readonly relevantFileCount: number;
  /** Total changed files in the PR. */
  readonly totalFileCount: number;
}
