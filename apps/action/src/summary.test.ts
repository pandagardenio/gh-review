import type { AutoReviewDecision } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { buildReviewBody, MARKER } from './summary.js';

const approveDecision: AutoReviewDecision = {
  outcome: 'approve',
  reason: 'No changes in review-required categories — only low-risk code/docs changed.',
  relevantCategories: [],
  relevantFileCount: 0,
  totalFileCount: 3,
};

const humanDecision: AutoReviewDecision = {
  outcome: 'review-required',
  reason: 'Human review required: 1 changed file(s) in review-required categories (dependencies).',
  relevantCategories: ['dependencies'],
  relevantFileCount: 1,
  totalFileCount: 4,
};

describe('buildReviewBody', () => {
  it('embeds the marker so we can recognize our own reviews', () => {
    expect(buildReviewBody(approveDecision, { mode: 'auto' })).toContain(MARKER);
  });

  it('states the reason and counts for an approval', () => {
    const body = buildReviewBody(approveDecision, { mode: 'auto' });
    expect(body).toContain('auto-approved');
    expect(body).toContain(approveDecision.reason);
    expect(body).toContain('Changed files: **3**');
  });

  it('reminds that a human owns the decision when review is required', () => {
    const body = buildReviewBody(humanDecision, { mode: 'auto' });
    expect(body).toContain('human review required');
    expect(body).toContain('dependencies');
    expect(body).toMatch(/human reviewer still owns/i);
  });

  it('describes a threshold policy with its cap', () => {
    expect(buildReviewBody(approveDecision, { mode: 'threshold', maxFiles: 7 })).toContain(
      'threshold (maxFiles: 7)',
    );
  });
});
