/**
 * Group changed files into ordered categories (BL-003).
 *
 * Pure function: `(files) -> orderedCategories[]`. Each file lands in exactly
 * one bucket (first matching rule wins), and buckets come back in the canonical
 * review order of {@link CATEGORY_RULES}. Empty buckets are omitted — the engine
 * orders and groups; "Code collapsed by default" is a UI concern (BL-005).
 */

import type { DiffFile } from '../diff/model.js';
import type { CategoryId, FileCategory } from './model.js';
import { CATEGORY_RULES } from './rules.js';

interface Bucket {
  label: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
}

export function categorize(files: readonly DiffFile[]): FileCategory[] {
  const buckets = new Map<CategoryId, Bucket>();

  for (const file of files) {
    const rule = CATEGORY_RULES.find((r) => r.match(file.path));
    // The final `code` rule matches everything, so `rule` is always defined.
    if (!rule) continue;
    let bucket = buckets.get(rule.id);
    if (!bucket) {
      bucket = { label: rule.label, files: [], additions: 0, deletions: 0 };
      buckets.set(rule.id, bucket);
    }
    bucket.files.push(file);
    bucket.additions += file.additions;
    bucket.deletions += file.deletions;
  }

  // Emit in canonical rule order, skipping empties.
  const ordered: FileCategory[] = [];
  for (const rule of CATEGORY_RULES) {
    const bucket = buckets.get(rule.id);
    if (!bucket) continue;
    ordered.push({
      id: rule.id,
      label: bucket.label,
      files: bucket.files,
      fileCount: bucket.files.length,
      additions: bucket.additions,
      deletions: bucket.deletions,
    });
  }
  return ordered;
}
