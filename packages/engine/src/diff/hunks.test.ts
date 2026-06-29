import { describe, expect, it } from 'vitest';
import { parseHunks } from './hunks.js';

describe('parseHunks', () => {
  it('assigns correct old and new line numbers across a change', () => {
    const patch = [
      '@@ -1,4 +1,4 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      ' const c = 4;',
      ' const d = 5;',
    ].join('\n');
    const [hunk] = parseHunks(patch);
    expect(hunk.lines).toEqual([
      { kind: 'context', content: 'const a = 1;', oldLine: 1, newLine: 1 },
      { kind: 'remove', content: 'const b = 2;', oldLine: 2 },
      { kind: 'add', content: 'const b = 3;', newLine: 2 },
      { kind: 'context', content: 'const c = 4;', oldLine: 3, newLine: 3 },
      { kind: 'context', content: 'const d = 5;', oldLine: 4, newLine: 4 },
    ]);
  });

  it('parses the hunk header counts and section', () => {
    const patch = ['@@ -10,3 +20,4 @@ function foo() {', ' a', '+b', ' c'].join('\n');
    const [hunk] = parseHunks(patch);
    expect(hunk.oldStart).toBe(10);
    expect(hunk.oldLines).toBe(3);
    expect(hunk.newStart).toBe(20);
    expect(hunk.newLines).toBe(4);
    expect(hunk.section).toBe('function foo() {');
  });

  it('defaults omitted line counts to 1', () => {
    const [hunk] = parseHunks(['@@ -5 +5 @@', '-x', '+y'].join('\n'));
    expect(hunk.oldLines).toBe(1);
    expect(hunk.newLines).toBe(1);
    expect(hunk.lines[0]).toEqual({ kind: 'remove', content: 'x', oldLine: 5 });
    expect(hunk.lines[1]).toEqual({ kind: 'add', content: 'y', newLine: 5 });
  });

  it('handles multiple hunks with independent counters', () => {
    const patch = ['@@ -1,1 +1,1 @@', '-a', '+A', '@@ -50,2 +50,2 @@', ' x', '-y', '+Y'].join('\n');
    const hunks = parseHunks(patch);
    expect(hunks).toHaveLength(2);
    expect(hunks[1].lines[0]).toEqual({ kind: 'context', content: 'x', oldLine: 50, newLine: 50 });
    expect(hunks[1].lines[2]).toEqual({ kind: 'add', content: 'Y', newLine: 51 });
  });

  it('ignores the "no newline at end of file" marker', () => {
    const patch = ['@@ -1 +1 @@', '-a', '\\ No newline at end of file', '+b'].join('\n');
    const [hunk] = parseHunks(patch);
    expect(hunk.lines.map((l) => l.kind)).toEqual(['remove', 'add']);
  });

  it('returns an empty array for an empty patch', () => {
    expect(parseHunks('')).toEqual([]);
  });
});
