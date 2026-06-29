import { describe, expect, it } from 'vitest';
import type { DiffFile, PullRequestDiff } from '../diff/model.js';
import { implementationTarget, resolveImplementationPath } from './implementation.js';

describe('resolveImplementationPath', () => {
  it('strips a .spec/.test infix, keeping the extension', () => {
    expect(resolveImplementationPath('x.spec.ts')).toBe('x.ts');
    expect(resolveImplementationPath('src/util.test.tsx')).toBe('src/util.tsx');
    expect(resolveImplementationPath('a/b/c.spec.js')).toBe('a/b/c.js');
  });

  it('drops a __tests__ directory to find the sibling', () => {
    expect(resolveImplementationPath('src/__tests__/x.test.ts')).toBe('src/x.ts');
    expect(resolveImplementationPath('__tests__/x.test.ts')).toBe('x.ts');
    expect(resolveImplementationPath('src/__tests__/x.ts')).toBe('src/x.ts');
  });

  it('returns null for a non-test path', () => {
    expect(resolveImplementationPath('src/x.ts')).toBeNull();
    expect(resolveImplementationPath('README.md')).toBeNull();
  });
});

const file = (path: string): DiffFile => ({
  path,
  change: 'modified',
  additions: 1,
  deletions: 0,
  isBinary: false,
  patch: '@@',
});

const diff = (paths: string[]): PullRequestDiff => ({
  owner: 'octo',
  repo: 'repo',
  number: 7,
  headSha: 'abc123',
  files: paths.map(file),
});

describe('implementationTarget', () => {
  it('points at the Triage diff when the implementation is in the PR', () => {
    const target = implementationTarget('src/x.test.ts', diff(['src/x.ts', 'src/x.test.ts']));
    expect(target).toEqual({ path: 'src/x.ts', location: 'in-pr' });
  });

  it('points at the head-branch blob when the implementation is not in the PR', () => {
    const target = implementationTarget('src/x.test.ts', diff(['src/x.test.ts']));
    expect(target).toEqual({
      path: 'src/x.ts',
      location: 'external',
      url: 'https://github.com/octo/repo/blob/abc123/src/x.ts',
    });
  });

  it('returns null when no sibling resolves', () => {
    expect(implementationTarget('src/x.ts', diff(['src/x.ts']))).toBeNull();
  });
});
