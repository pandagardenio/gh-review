import type { DiffFile } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { lazyFileDiff, renderFileDiff } from './diff-view.js';

const file = (over: Partial<DiffFile> = {}): DiffFile => ({
  path: 'src/app.ts',
  change: 'modified',
  additions: 1,
  deletions: 1,
  isBinary: false,
  patch: [
    '@@ -1,3 +1,3 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    ' const c = 4;',
  ].join('\n'),
  ...over,
});

describe('renderFileDiff', () => {
  it('renders one row per diff line with old/new gutters', async () => {
    const view = await renderFileDiff(file());
    const rows = view.querySelectorAll('.triage-diff__row');
    expect(rows).toHaveLength(4);

    const removed = view.querySelector('.triage-diff__row--remove') as HTMLElement;
    expect(removed.querySelector('.triage-diff__gutter--old')?.textContent).toBe('2');
    expect(removed.querySelector('.triage-diff__gutter--new')?.textContent).toBe('');
    expect(removed.querySelector('.triage-diff__marker')?.textContent).toBe('-');
    expect(removed.querySelector('.triage-diff__content')?.textContent).toBe('const b = 2;');
  });

  it('anchors each row with old/new line data for later comments', async () => {
    const view = await renderFileDiff(file());
    const added = view.querySelector('.triage-diff__row--add') as HTMLElement;
    expect(added.getAttribute('data-new-line')).toBe('2');
    expect(added.getAttribute('data-old-line')).toBe('');
  });

  it('renders the hunk header', async () => {
    const view = await renderFileDiff(file());
    expect(view.querySelector('.triage-diff__hunk')?.textContent).toBe('@@ -1,3 +1,3 @@');
  });

  it('shows a binary affordance instead of an empty view', async () => {
    const view = await renderFileDiff(file({ isBinary: true, patch: undefined }));
    expect(view.classList.contains('triage-diff--patchless')).toBe(true);
    expect(view.querySelector('.triage-diff__notice')?.textContent).toContain('Binary');
    expect(view.querySelector('.triage-diff__open')?.getAttribute('href')).toMatch(
      /^#diff-[0-9a-f]{64}$/,
    );
  });

  it('shows a graceful affordance for a patch-less (non-binary) file', async () => {
    const view = await renderFileDiff(file({ patch: undefined }));
    expect(view.classList.contains('triage-diff--patchless')).toBe(true);
    expect(view.querySelector('.triage-diff__notice')?.textContent).toBe(
      'No inline diff available.',
    );
  });

  it('builds CSP-safe: patch content with markup stays text', async () => {
    const view = await renderFileDiff(file({ patch: '@@ -1 +1 @@\n+<script>alert(1)</script>' }));
    expect(view.querySelector('script')).toBeNull();
    expect(view.querySelector('.triage-diff__content')?.textContent).toBe(
      '<script>alert(1)</script>',
    );
  });
});

describe('lazyFileDiff', () => {
  it('does not render until revealed', async () => {
    const { element, reveal } = lazyFileDiff(file());
    expect(element.querySelector('.triage-diff__row')).toBeNull();
    await reveal();
    expect(element.querySelectorAll('.triage-diff__row')).toHaveLength(4);
  });

  it('reveal is idempotent (no duplicate render)', async () => {
    const { element, reveal } = lazyFileDiff(file());
    await reveal();
    await reveal();
    expect(element.querySelectorAll('.triage-diff__row')).toHaveLength(4);
  });
});
