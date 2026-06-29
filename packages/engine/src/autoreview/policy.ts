/**
 * Autoreview policy evaluation + config parsing (BL-016) — pure engine logic.
 *
 * `evaluateAutoReview` is the whole decision: categorized diff + policy → verdict.
 * It is deliberately conservative (Constitution principle 5, robustness over
 * cleverness): when in doubt it routes to a human, and it never *hides* a file —
 * "review-required" is the default outcome, auto-approval the narrow exception.
 */

import type { CategoryId, FileCategory } from '../categorize/model.js';
import { isReviewRequiredCategory } from '../categorize/rules.js';
import type { AutoApprovalPolicy, AutoReviewDecision } from './model.js';

/** Approve the null case whenever it occurs. The safe, simple default. */
export const DEFAULT_POLICY: AutoApprovalPolicy = { mode: 'auto' };

/**
 * Decide what the bot should do with a PR.
 *
 * Order of checks (first hit wins):
 * 1. `never`                       → always review-required.
 * 2. any review-required file      → review-required (a human must look).
 * 3. `threshold` and over the cap  → review-required (too large to wave through).
 * 4. otherwise                     → approve (the null case).
 */
export function evaluateAutoReview(
  categories: readonly FileCategory[],
  policy: AutoApprovalPolicy = DEFAULT_POLICY,
): AutoReviewDecision {
  const relevant = categories.filter((category) => isReviewRequiredCategory(category.id));
  const relevantCategories: CategoryId[] = relevant.map((category) => category.id);
  const relevantFileCount = relevant.reduce((sum, category) => sum + category.fileCount, 0);
  const totalFileCount = categories.reduce((sum, category) => sum + category.fileCount, 0);
  const evidence = { relevantCategories, relevantFileCount, totalFileCount };
  const review = (reason: string): AutoReviewDecision => ({
    outcome: 'review-required',
    reason,
    ...evidence,
  });

  if (policy.mode === 'never') {
    return review('Auto-approval is disabled (mode: never).');
  }

  if (relevantFileCount > 0) {
    return review(
      `Human review required: ${relevantFileCount} changed file(s) in review-required categories (${relevantCategories.join(', ')}).`,
    );
  }

  if (policy.mode === 'threshold' && totalFileCount > policy.maxFiles) {
    return review(
      `No review-required changes, but ${totalFileCount} changed files exceeds the auto-approve threshold of ${policy.maxFiles}.`,
    );
  }

  return {
    outcome: 'approve',
    reason:
      totalFileCount === 0
        ? 'No changed files to review.'
        : 'No changes in review-required categories — only low-risk code/docs changed.',
    ...evidence,
  };
}

/**
 * Validate + normalize raw config (parsed JSON / action inputs) into a policy.
 * Throws a clear error on anything malformed rather than guessing — a
 * confident-but-wrong policy is the worst failure mode here (principle 5).
 * `null`/`undefined` means "unconfigured" and yields {@link DEFAULT_POLICY}.
 */
export function parseAutoReviewPolicy(raw: unknown): AutoApprovalPolicy {
  if (raw === null || raw === undefined) return DEFAULT_POLICY;
  if (typeof raw !== 'object') {
    throw new Error(`Autoreview policy must be an object, got ${typeof raw}.`);
  }

  const record = raw as Record<string, unknown>;
  const mode = record.mode ?? 'auto';

  if (mode === 'auto') return { mode: 'auto' };
  if (mode === 'never') return { mode: 'never' };
  if (mode === 'threshold') {
    const maxFiles = record.maxFiles;
    if (typeof maxFiles !== 'number' || !Number.isInteger(maxFiles) || maxFiles < 0) {
      throw new Error('Autoreview policy mode "threshold" requires an integer "maxFiles" >= 0.');
    }
    return { mode: 'threshold', maxFiles };
  }

  throw new Error(
    `Unknown autoreview policy mode: ${JSON.stringify(mode)} (expected auto | never | threshold).`,
  );
}
