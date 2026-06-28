/**
 * Map GitHub's REST `/pulls/{n}/files` payload into the engine's
 * {@link DiffFile} model (BL-002 fallback source).
 *
 * The API gives `additions`/`deletions`/`status` directly and a `patch` per
 * file — except for binary or oversized files, where `patch` is absent. Those
 * are represented with `isBinary`, never dropped (BL-002 acceptance).
 */

import type { DiffFile, FileChangeKind } from './model.js';

/** The subset of a REST pull-request file object the engine consumes. */
export interface ApiPullRequestFile {
  readonly filename: string;
  readonly previous_filename?: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch?: string;
}

export function mapApiFiles(files: readonly ApiPullRequestFile[]): DiffFile[] {
  return files.map(mapApiFile);
}

function mapApiFile(file: ApiPullRequestFile): DiffFile {
  const change = mapStatus(file.status);
  const previousPath = change === 'renamed' ? (file.previous_filename ?? undefined) : undefined;
  return {
    path: file.filename,
    ...(previousPath ? { previousPath } : {}),
    change,
    additions: file.additions,
    deletions: file.deletions,
    // No patch on a text file means binary or too large to inline.
    isBinary: file.patch === undefined,
    ...(file.patch !== undefined ? { patch: file.patch } : {}),
  };
}

// GitHub statuses: added, removed, modified, renamed, copied, changed, unchanged.
function mapStatus(status: string): FileChangeKind {
  switch (status) {
    case 'added':
    case 'copied':
      return 'added';
    case 'removed':
      return 'removed';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}
