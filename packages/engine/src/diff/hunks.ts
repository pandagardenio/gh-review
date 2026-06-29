/**
 * Parse a single file's unified `patch` into hunks with per-line **old and new
 * line numbers** (BL-006).
 *
 * Getting old/new numbers right per row, per side, is the substrate for comment
 * anchoring (BL-010) — the riskiest MVP integration (MVP.md §7). A `context`
 * line carries both numbers (it exists on LEFT and RIGHT); an `add` carries only
 * `newLine` (RIGHT); a `remove` carries only `oldLine` (LEFT).
 */

export type DiffLineKind = 'context' | 'add' | 'remove';

/** One rendered diff line with the line numbers that anchor it. */
export interface DiffLine {
  readonly kind: DiffLineKind;
  /** Line text without the leading `+`/`-`/space marker. */
  readonly content: string;
  /** 1-based old-file line — present for `context` and `remove`. */
  readonly oldLine?: number;
  /** 1-based new-file line — present for `context` and `add`. */
  readonly newLine?: number;
}

/** A `@@ … @@` hunk and its lines. */
export interface DiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  /** Trailing context after the `@@ … @@` (often the enclosing function). */
  readonly section: string;
  readonly lines: readonly DiffLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/** Parse `patch` into its hunks. Returns `[]` for an empty/absent patch. */
export function parseHunks(patch: string): DiffHunk[] {
  if (!patch) return [];
  const hunks: DiffHunk[] = [];
  let current: MutableHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split('\n')) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      current = startHunk(header);
      hunks.push(current);
      oldLine = current.oldStart;
      newLine = current.newStart;
      continue;
    }
    if (!current) continue; // preamble before the first hunk, if any
    const marker = raw[0] ?? ' ';
    if (marker === '\\') continue; // "\ No newline at end of file"
    const content = raw.slice(1);
    if (marker === '+') {
      current.lines.push({ kind: 'add', content, newLine });
      newLine++;
    } else if (marker === '-') {
      current.lines.push({ kind: 'remove', content, oldLine });
      oldLine++;
    } else {
      current.lines.push({ kind: 'context', content, oldLine, newLine });
      oldLine++;
      newLine++;
    }
  }
  return hunks;
}

interface MutableHunk extends Omit<DiffHunk, 'lines'> {
  lines: DiffLine[];
}

function startHunk(header: RegExpExecArray): MutableHunk {
  return {
    oldStart: Number(header[1]),
    oldLines: header[2] === undefined ? 1 : Number(header[2]),
    newStart: Number(header[3]),
    newLines: header[4] === undefined ? 1 : Number(header[4]),
    section: (header[5] ?? '').trimStart(),
    lines: [],
  };
}
