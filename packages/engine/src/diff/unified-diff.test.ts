import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from './unified-diff.js';

describe('parseUnifiedDiff', () => {
  it('parses a modified file with additions and deletions', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1111111..2222222 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,3 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      ' const c = 4;',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(diff);
    expect(file.path).toBe('src/app.ts');
    expect(file.change).toBe('modified');
    expect(file.additions).toBe(1);
    expect(file.deletions).toBe(1);
    expect(file.isBinary).toBe(false);
    expect(file.patch).toContain('@@ -1,3 +1,3 @@');
    expect(file.patch?.endsWith('\n')).toBe(false);
  });

  it('classifies an added file', () => {
    const diff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+line one',
      '+line two',
    ].join('\n');
    const [file] = parseUnifiedDiff(diff);
    expect(file.change).toBe('added');
    expect(file.path).toBe('new.ts');
    expect(file.previousPath).toBeUndefined();
    expect(file.additions).toBe(2);
    expect(file.deletions).toBe(0);
  });

  it('classifies a deleted file', () => {
    const diff = [
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      'index abc1234..0000000',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-line one',
      '-line two',
    ].join('\n');
    const [file] = parseUnifiedDiff(diff);
    expect(file.change).toBe('removed');
    expect(file.path).toBe('gone.ts');
    expect(file.deletions).toBe(2);
  });

  it('captures previousPath on a rename with no content change', () => {
    const diff = [
      'diff --git a/old/name.ts b/new/name.ts',
      'similarity index 100%',
      'rename from old/name.ts',
      'rename to new/name.ts',
    ].join('\n');
    const [file] = parseUnifiedDiff(diff);
    expect(file.change).toBe('renamed');
    expect(file.path).toBe('new/name.ts');
    expect(file.previousPath).toBe('old/name.ts');
    expect(file.patch).toBeUndefined();
    expect(file.additions).toBe(0);
  });

  it('represents a binary file with isBinary and no patch', () => {
    const diff = [
      'diff --git a/logo.png b/logo.png',
      'index 1111111..2222222 100644',
      'Binary files a/logo.png and b/logo.png differ',
    ].join('\n');
    const [file] = parseUnifiedDiff(diff);
    expect(file.isBinary).toBe(true);
    expect(file.path).toBe('logo.png');
    expect(file.patch).toBeUndefined();
  });

  it('parses multiple files in one diff', () => {
    const diff = [
      'diff --git a/one.ts b/one.ts',
      '--- a/one.ts',
      '+++ b/one.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      'diff --git a/two.ts b/two.ts',
      '--- a/two.ts',
      '+++ b/two.ts',
      '@@ -1 +1 @@',
      '-c',
      '+d',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.map((f) => f.path)).toEqual(['one.ts', 'two.ts']);
  });

  it('returns an empty list for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});
