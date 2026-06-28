import { describe, expect, it } from 'vitest';
import { type ApiPullRequestFile, mapApiFiles } from './api-files.js';

describe('mapApiFiles', () => {
  const file = (over: Partial<ApiPullRequestFile>): ApiPullRequestFile => ({
    filename: 'src/app.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    patch: '@@ -1 +1 @@\n-a\n+b',
    ...over,
  });

  it('maps a modified file', () => {
    const [mapped] = mapApiFiles([file({})]);
    expect(mapped.path).toBe('src/app.ts');
    expect(mapped.change).toBe('modified');
    expect(mapped.additions).toBe(1);
    expect(mapped.deletions).toBe(1);
    expect(mapped.isBinary).toBe(false);
    expect(mapped.patch).toContain('@@');
  });

  it('maps status values to change kinds', () => {
    const kinds = mapApiFiles([
      file({ status: 'added' }),
      file({ status: 'removed' }),
      file({ status: 'renamed', previous_filename: 'old.ts' }),
      file({ status: 'copied' }),
      file({ status: 'changed' }),
    ]).map((f) => f.change);
    expect(kinds).toEqual(['added', 'removed', 'renamed', 'added', 'modified']);
  });

  it('keeps previousPath only for renames', () => {
    const [renamed] = mapApiFiles([
      file({ status: 'renamed', previous_filename: 'old.ts', filename: 'new.ts' }),
    ]);
    expect(renamed.previousPath).toBe('old.ts');
    const [modified] = mapApiFiles([file({ previous_filename: 'ignored.ts' })]);
    expect(modified.previousPath).toBeUndefined();
  });

  it('flags a patch-less (binary/large) file as binary, never dropping it', () => {
    const [mapped] = mapApiFiles([file({ patch: undefined, additions: 0, deletions: 0 })]);
    expect(mapped.isBinary).toBe(true);
    expect(mapped.patch).toBeUndefined();
    expect(mapped.path).toBe('src/app.ts');
  });
});
