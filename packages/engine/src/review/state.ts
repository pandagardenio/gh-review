/**
 * Review viewed-state + progress (BL-007).
 *
 * Pure, **serializable** state so BL-011 can persist it without reshaping
 * (technical note): viewed files are a plain array of paths. All updates are
 * immutable. Serves Constitution principle 1 (review by section/intent) and
 * principle 2 (a reviewed block is collapsed, never hidden — collapse is a UI
 * concern; this layer only tracks what has been viewed).
 */

import type { FileCategory } from '../categorize/model.js';

/** The whole review's viewed state. Serializable as-is (array, not Set). */
export interface ReviewState {
  /** Paths the reviewer has marked viewed. Sorted, unique. */
  readonly viewedPaths: readonly string[];
}

export interface ReviewProgress {
  readonly viewed: number;
  readonly total: number;
}

export interface SectionProgress extends ReviewProgress {
  readonly id: FileCategory['id'];
  readonly label: string;
}

/** Empty state, or one seeded from a (possibly partial) restored value. */
export function createReviewState(initial?: Partial<ReviewState>): ReviewState {
  return { viewedPaths: normalize(initial?.viewedPaths ?? []) };
}

export function isFileViewed(state: ReviewState, path: string): boolean {
  return state.viewedPaths.includes(path);
}

/** Mark one file viewed/unviewed. */
export function setFileViewed(state: ReviewState, path: string, viewed: boolean): ReviewState {
  return setFilesViewed(state, [path], viewed);
}

/** Mark a set of files viewed/unviewed in one update (block-level action). */
export function setFilesViewed(
  state: ReviewState,
  paths: readonly string[],
  viewed: boolean,
): ReviewState {
  const next = new Set(state.viewedPaths);
  for (const path of paths) {
    if (viewed) next.add(path);
    else next.delete(path);
  }
  return { viewedPaths: normalize([...next]) };
}

/** Per-section progress; `total` is the section's file count. */
export function sectionProgress(category: FileCategory, state: ReviewState): SectionProgress {
  const viewed = category.files.reduce(
    (n, file) => n + (isFileViewed(state, file.path) ? 1 : 0),
    0,
  );
  return { id: category.id, label: category.label, viewed, total: category.fileCount };
}

/** Overall progress across the categories present in the diff (ignores stale paths). */
export function overallProgress(
  categories: readonly FileCategory[],
  state: ReviewState,
): ReviewProgress {
  return categories.reduce(
    (acc, category) => {
      const p = sectionProgress(category, state);
      return { viewed: acc.viewed + p.viewed, total: acc.total + p.total };
    },
    { viewed: 0, total: 0 },
  );
}

function normalize(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}
