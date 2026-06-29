/**
 * Heuristic test-case parsing (BL-008).
 *
 * For a test file's patch, pull `describe`/`context`/`it`/`test` titles and
 * classify each as added / deleted / changed — surfacing *what behaviour
 * changed*, not just which lines moved (Constitution principle 1). This is a
 * regex over patch lines, not an AST (MVP.md §4.3): it degrades quietly when a
 * title can't be parsed and never invents a case (principle 5).
 *
 * Classification (per title):
 *   - title line only on `+`  → **added**
 *   - title line only on `-`  → **deleted**
 *   - title line on both / a `case` whose body lines changed → **changed**
 */

import { parseHunks } from '../diff/hunks.js';

export type TestCaseStatus = 'added' | 'deleted' | 'changed';
export type TestCaseKind = 'suite' | 'case';

export interface TestCase {
  readonly title: string;
  readonly kind: TestCaseKind;
  readonly status: TestCaseStatus;
}

// `describe('x'`, `it.only("y"`, `test(\`z\``  — keyword, then a quoted title.
const TITLE = /^\s*(describe|context|it|test)\b(?:\.\w+)*\s*\(\s*(['"`])((?:\\.|(?!\2).)*)\2/;

// A lone block close (`}`, `})`, `});`) — ends the current case's body scope so a
// later, unrelated change is not mis-attributed to it.
const CLOSE = /^\s*\}\s*\)?\s*;?\s*$/;

interface Occurrence {
  kind: TestCaseKind;
  order: number;
  add: boolean;
  remove: boolean;
  context: boolean;
  touched: boolean;
}

/** Parse and classify the test cases changed in a patch. */
export function parseTestCases(patch: string): TestCase[] {
  const occ = new Map<string, Occurrence>();
  let order = 0;
  let currentCaseTitle: string | null = null;

  for (const hunk of parseHunks(patch)) {
    for (const line of hunk.lines) {
      const match = TITLE.exec(line.content);
      if (match) {
        const kind: TestCaseKind = match[1] === 'it' || match[1] === 'test' ? 'case' : 'suite';
        const title = match[3] as string;
        const entry = ensure(occ, title, kind, order);
        if (entry.order === order) order++;
        if (line.kind === 'add') entry.add = true;
        else if (line.kind === 'remove') entry.remove = true;
        else entry.context = true;
        // Track the enclosing case so its body changes mark it "changed".
        currentCaseTitle = kind === 'case' && line.kind === 'context' ? title : null;
      } else if (line.kind !== 'context' && currentCaseTitle) {
        const entry = occ.get(currentCaseTitle);
        if (entry) entry.touched = true;
      } else if (line.kind === 'context' && CLOSE.test(line.content)) {
        currentCaseTitle = null; // end of the current case's body
      }
    }
  }

  return [...occ.entries()]
    .map(([title, e]) => ({ title, e }))
    .sort((a, b) => a.e.order - b.e.order)
    .map(({ title, e }) => ({ title, kind: e.kind, status: classify(e) }))
    .filter((c): c is TestCase => c.status !== null);
}

function ensure(
  occ: Map<string, Occurrence>,
  title: string,
  kind: TestCaseKind,
  order: number,
): Occurrence {
  const existing = occ.get(title);
  if (existing) return existing;
  const created: Occurrence = {
    kind,
    order,
    add: false,
    remove: false,
    context: false,
    touched: false,
  };
  occ.set(title, created);
  return created;
}

function classify(e: Occurrence): TestCaseStatus | null {
  if (e.add && e.remove) return 'changed';
  if (e.add) return 'added';
  if (e.remove) return 'deleted';
  if (e.kind === 'case' && e.touched) return 'changed';
  return null; // unchanged title with no body change — not reported
}
