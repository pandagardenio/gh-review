/**
 * Provider-agnostic diff model.
 *
 * This is the shared shape the loader (BL-002) produces and the categorizer
 * (BL-003), renderer (BL-006) and panel (BL-005) consume — independent of
 * whether the bytes came from `.diff` or the REST API. Kept intentionally small
 * here; later items flesh out hunks and line-level structure.
 */

/** Whether a file was added, removed, modified, or renamed in the PR. */
export type FileChangeKind = 'added' | 'removed' | 'modified' | 'renamed';

/** One changed file in a pull request. */
export interface DiffFile {
  /** Current path (the `b/` side); equals {@link previousPath} unless renamed. */
  readonly path: string;
  /** Prior path (the `a/` side) when the file was renamed; otherwise undefined. */
  readonly previousPath?: string;
  readonly change: FileChangeKind;
  /** Raw unified-diff patch for this file, when available. */
  readonly patch?: string;
}

/** A pull request's full set of changed files. */
export interface PullRequestDiff {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  /** Head commit SHA — the draft-state key component (CLAUDE.md local-first). */
  readonly headSha: string;
  readonly files: readonly DiffFile[];
}
