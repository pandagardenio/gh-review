import { describe, expect, it } from 'vitest';
import { categorize } from '../categorize/categorize.js';
import type { DiffFile } from '../diff/model.js';
import { DEFAULT_POLICY, evaluateAutoReview, parseAutoReviewPolicy } from './policy.js';

const file = (path: string): DiffFile => ({
  path,
  change: 'modified',
  additions: 1,
  deletions: 0,
  isBinary: false,
  patch: '@@',
});

/** Evaluate a set of paths under a policy. */
const decide = (paths: string[], policy = DEFAULT_POLICY) =>
  evaluateAutoReview(categorize(paths.map(file)), policy);

describe('evaluateAutoReview', () => {
  it('approves a PR with only code changes (null case)', () => {
    const decision = decide(['src/app.ts', 'src/util.ts']);
    expect(decision.outcome).toBe('approve');
    expect(decision.relevantFileCount).toBe(0);
    expect(decision.totalFileCount).toBe(2);
  });

  it('approves a docs-only PR', () => {
    expect(decide(['README.md', 'docs/guide.md']).outcome).toBe('approve');
  });

  it('approves an empty PR with a "no changed files" reason', () => {
    const decision = decide([]);
    expect(decision.outcome).toBe('approve');
    expect(decision.reason).toMatch(/no changed files/i);
  });

  it('requires a human when a dependency manifest changed', () => {
    const decision = decide(['package.json', 'src/app.ts']);
    expect(decision.outcome).toBe('review-required');
    expect(decision.relevantCategories).toContain('dependencies');
    expect(decision.relevantFileCount).toBe(1);
  });

  it('requires a human when CI or config changed', () => {
    expect(decide(['.github/workflows/ci.yml']).outcome).toBe('review-required');
    expect(decide(['tsconfig.json']).outcome).toBe('review-required');
  });

  it('requires a human when tests or harness changed', () => {
    expect(decide(['src/app.test.ts']).outcome).toBe('review-required');
    expect(decide(['.claude/rules/git.md']).outcome).toBe('review-required');
  });

  it('never approves under mode: never, even for the null case', () => {
    const decision = decide(['src/app.ts'], { mode: 'never' });
    expect(decision.outcome).toBe('review-required');
    expect(decision.reason).toMatch(/disabled/i);
  });

  it('approves under threshold when the null case fits the cap', () => {
    const decision = decide(['a.ts', 'b.ts'], { mode: 'threshold', maxFiles: 2 });
    expect(decision.outcome).toBe('approve');
  });

  it('requires a human under threshold when too many files changed', () => {
    const decision = decide(['a.ts', 'b.ts', 'c.ts'], { mode: 'threshold', maxFiles: 2 });
    expect(decision.outcome).toBe('review-required');
    expect(decision.reason).toMatch(/threshold/i);
  });

  it('still requires a human under threshold when a review-required file changed', () => {
    // Review-required check wins over the threshold check.
    const decision = decide(['package.json'], { mode: 'threshold', maxFiles: 50 });
    expect(decision.outcome).toBe('review-required');
    expect(decision.relevantCategories).toContain('dependencies');
  });
});

describe('parseAutoReviewPolicy', () => {
  it('defaults to mode auto when unconfigured', () => {
    expect(parseAutoReviewPolicy(null)).toEqual({ mode: 'auto' });
    expect(parseAutoReviewPolicy(undefined)).toEqual({ mode: 'auto' });
    expect(parseAutoReviewPolicy({})).toEqual({ mode: 'auto' });
  });

  it('parses each valid mode', () => {
    expect(parseAutoReviewPolicy({ mode: 'auto' })).toEqual({ mode: 'auto' });
    expect(parseAutoReviewPolicy({ mode: 'never' })).toEqual({ mode: 'never' });
    expect(parseAutoReviewPolicy({ mode: 'threshold', maxFiles: 10 })).toEqual({
      mode: 'threshold',
      maxFiles: 10,
    });
  });

  it('rejects a threshold without a valid maxFiles', () => {
    expect(() => parseAutoReviewPolicy({ mode: 'threshold' })).toThrow(/maxFiles/);
    expect(() => parseAutoReviewPolicy({ mode: 'threshold', maxFiles: -1 })).toThrow(/maxFiles/);
    expect(() => parseAutoReviewPolicy({ mode: 'threshold', maxFiles: 1.5 })).toThrow(/maxFiles/);
  });

  it('rejects an unknown mode and a non-object', () => {
    expect(() => parseAutoReviewPolicy({ mode: 'sometimes' })).toThrow(
      /Unknown autoreview policy mode/,
    );
    expect(() => parseAutoReviewPolicy('auto')).toThrow(/must be an object/);
  });
});
