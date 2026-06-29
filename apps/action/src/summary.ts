/**
 * Build the Markdown body the bot posts as its review, plus the hidden marker we
 * use to recognize our own prior reviews (idempotency + stale-approval cleanup).
 *
 * The body always states *why* — never a bare verdict (principle 5: never
 * silently mislead) — and always reminds the reader that "review-required" means
 * a human still owns the decision (principle 4).
 */

import type { AutoApprovalPolicy, AutoReviewDecision } from '@triage/engine';

/** Hidden HTML comment identifying a review authored by this action. */
export const MARKER = '<!-- triage-autoreview -->';

export function buildReviewBody(decision: AutoReviewDecision, policy: AutoApprovalPolicy): string {
  const heading =
    decision.outcome === 'approve'
      ? '### ✅ Triage autoreview — auto-approved'
      : '### 👀 Triage autoreview — human review required';

  const lines = [
    MARKER,
    heading,
    '',
    decision.reason,
    '',
    `- Changed files: **${decision.totalFileCount}**`,
    `- Review-required files: **${decision.relevantFileCount}**${categoriesSuffix(decision)}`,
    `- Policy: \`${describePolicy(policy)}\``,
  ];

  if (decision.outcome === 'review-required') {
    lines.push(
      '',
      '> This is not a block — it organizes, it does not decide. A human reviewer still owns the approval.',
    );
  }

  return lines.join('\n');
}

function categoriesSuffix(decision: AutoReviewDecision): string {
  return decision.relevantCategories.length > 0
    ? ` (${decision.relevantCategories.join(', ')})`
    : '';
}

function describePolicy(policy: AutoApprovalPolicy): string {
  return policy.mode === 'threshold' ? `threshold (maxFiles: ${policy.maxFiles})` : policy.mode;
}
