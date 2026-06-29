/**
 * Categorization model (BL-003).
 *
 * Files are bucketed by **intent and risk**, not by file order or diff size —
 * the literal mechanism of Constitution principle 1. The bucket order *is* the
 * review order (MVP.md §3).
 */

import type { DiffFile } from '../diff/model.js';

/** The seven buckets, in review order. `code` is the catch-all. */
export type CategoryId = 'dependencies' | 'harness' | 'ci' | 'config' | 'tests' | 'docs' | 'code';

/**
 * One ordered rule. The {@link CATEGORY_RULES} array is **product surface**:
 * adding or moving a rule is a product decision measured against the
 * constitution, not a throwaway tweak (MVP.md §3, BL-003 acceptance).
 */
export interface CategoryRule {
  readonly id: CategoryId;
  /** Human label for the section header (BL-005 renders it). */
  readonly label: string;
  /** Whether a file path belongs to this rule. First match wins, top to bottom. */
  readonly match: (path: string) => boolean;
  /**
   * Whether changes in this category carry the intent/risk a human must review
   * (Constitution principle 1: dependencies, harness, config, CI, tests). Product
   * surface — the autoreview policy (BL-016) reads this to decide whether a PR can
   * be auto-approved. `code` and `docs` are *not* review-required: a PR touching
   * only those is the low-risk null case. De-emphasis, not hiding (principle 2):
   * "not review-required" never removes a file from review, it only means the bot
   * need not block on it.
   */
  readonly reviewRequired: boolean;
}

/** A non-empty bucket with its files and churn counts, ready for BL-005. */
export interface FileCategory {
  readonly id: CategoryId;
  readonly label: string;
  readonly files: readonly DiffFile[];
  readonly fileCount: number;
  /** Summed additions across the bucket's files. */
  readonly additions: number;
  /** Summed deletions across the bucket's files. */
  readonly deletions: number;
}
