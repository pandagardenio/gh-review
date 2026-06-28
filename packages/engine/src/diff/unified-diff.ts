/**
 * Parse a unified `git diff` (the same-origin `.diff` fast path) into the
 * engine's {@link DiffFile} model (BL-002).
 *
 * Source of truth for paths, in priority order, because any one signal can be
 * absent: `rename from/to` (a pure rename carries no `---`/`+++`), then the
 * `---`/`+++` header (handling `/dev/null`), then `Binary files a/X and b/Y`,
 * and finally the `diff --git` line as a last resort. Patch-less files (binary)
 * are represented with `isBinary`, never dropped (BL-002 acceptance).
 */

import type { DiffFile, FileChangeKind } from './model.js';

const FILE_HEADER = /^diff --git /;

/** Split the diff into per-file blocks and parse each. */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const lines = diff.split('\n');
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (FILE_HEADER.test(line)) {
      current = [line];
      blocks.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return blocks.map(parseFileBlock);
}

function parseFileBlock(block: string[]): DiffFile {
  let path = '';
  let previousPath: string | undefined;
  let renamed = false;
  let added = false;
  let removed = false;
  let isBinary = false;
  let hunkStart = -1;

  for (const [i, line] of block.entries()) {
    if (line.startsWith('@@')) {
      hunkStart = i;
      break; // hunks begin — everything after is patch body
    }
    if (line.startsWith('rename from ')) {
      previousPath = line.slice('rename from '.length);
      renamed = true;
    } else if (line.startsWith('rename to ')) {
      path = line.slice('rename to '.length);
      renamed = true;
    } else if (line.startsWith('new file mode')) {
      added = true;
    } else if (line.startsWith('deleted file mode')) {
      removed = true;
    } else if (line.startsWith('--- ')) {
      const p = stripSidePrefix(line.slice(4));
      if (p && !removed) previousPath ??= p;
    } else if (line.startsWith('+++ ')) {
      const p = stripSidePrefix(line.slice(4));
      if (p) path = p;
    } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      isBinary = true;
      const pair = parseBinaryLine(line);
      if (pair) {
        path ||= pair.b;
        previousPath ??= pair.a;
      }
    }
  }

  // Fall back to the `diff --git` line when no header settled the path.
  if (!path || (renamed && !previousPath)) {
    const guess = parseGitLine(block[0] ?? '');
    if (guess) {
      path ||= guess.b;
      if (renamed) previousPath ??= guess.a;
    }
  }

  const { patch, additions, deletions } = extractPatch(block, hunkStart, isBinary);
  const change = classify({ renamed, added, removed });
  return {
    path,
    ...(previousPath && previousPath !== path ? { previousPath } : {}),
    change,
    additions,
    deletions,
    isBinary,
    ...(patch !== undefined ? { patch } : {}),
  };
}

function extractPatch(
  block: string[],
  hunkStart: number,
  isBinary: boolean,
): { patch?: string; additions: number; deletions: number } {
  if (isBinary || hunkStart < 0) return { additions: 0, deletions: 0 };
  const body = block.slice(hunkStart);
  let additions = 0;
  let deletions = 0;
  for (const line of body) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  // Trim a single trailing empty line left by the split, preserving inner blanks.
  const end = body.length > 0 && body[body.length - 1] === '' ? body.length - 1 : body.length;
  return { patch: body.slice(0, end).join('\n'), additions, deletions };
}

function classify(flags: { renamed: boolean; added: boolean; removed: boolean }): FileChangeKind {
  if (flags.renamed) return 'renamed';
  if (flags.added) return 'added';
  if (flags.removed) return 'removed';
  return 'modified';
}

/** Strip a `a/`/`b/` side prefix; `/dev/null` (add/delete sentinel) → ''. */
function stripSidePrefix(raw: string): string {
  const value = raw.trim();
  if (value === '/dev/null') return '';
  if (value.startsWith('a/') || value.startsWith('b/')) return value.slice(2);
  return value;
}

function parseBinaryLine(line: string): { a: string; b: string } | null {
  const match = /^Binary files (.+) and (.+) differ$/.exec(line);
  if (!match) return null;
  return { a: stripSidePrefix(match[1] ?? ''), b: stripSidePrefix(match[2] ?? '') };
}

/**
 * Last-resort path parse of `diff --git a/<path> b/<path>`. Unquoted, symmetric
 * paths are the overwhelming common case here since better signals already won;
 * split on the ` b/` that separates the two equal halves.
 */
function parseGitLine(line: string): { a: string; b: string } | null {
  const rest = line.slice('diff --git '.length);
  const sep = rest.indexOf(' b/');
  if (sep < 0) return null;
  const a = stripSidePrefix(rest.slice(0, sep));
  const b = stripSidePrefix(rest.slice(sep + 1));
  return { a, b };
}
