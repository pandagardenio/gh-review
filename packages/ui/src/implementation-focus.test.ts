import type { DiffFile, PullRequestDiff } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createImplementationFocus } from './implementation-focus.js';

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

describe('createImplementationFocus', () => {
  it('offers an in-PR jump that calls onOpenInPr with the resolved path', () => {
    const onOpenInPr = vi.fn();
    const node = createImplementationFocus('src/x.test.ts', diff(['src/x.test.ts', 'src/x.ts']), {
      onOpenInPr,
    });
    expect(node.classList.contains('triage-impl--in-pr')).toBe(true);
    const button = node.querySelector('.triage-impl__open') as HTMLButtonElement;
    expect(button.textContent).toContain('src/x.ts');
    button.click();
    expect(onOpenInPr).toHaveBeenCalledWith('src/x.ts');
  });

  it('links to the head-branch blob for an out-of-PR implementation', () => {
    const node = createImplementationFocus('src/x.test.ts', diff(['src/x.test.ts']));
    expect(node.classList.contains('triage-impl--external')).toBe(true);
    const link = node.querySelector('.triage-impl__link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://github.com/octo/repo/blob/abc123/src/x.ts');
  });

  it('shows a plain notice when no sibling resolves', () => {
    const node = createImplementationFocus('src/x.ts', diff(['src/x.ts']));
    expect(node.classList.contains('triage-impl--none')).toBe(true);
    expect(node.textContent).toBe('No implementation file resolved.');
  });
});
