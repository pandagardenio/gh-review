import type { DiffFile } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createTestFileView } from './test-file-view.js';

const SPEC_PATCH = [
  '@@ -1,8 +1,9 @@',
  " describe('math', () => {",
  "   it('adds', () => {",
  '-    expect(add(1, 1)).toBe(1);',
  '+    expect(add(1, 1)).toBe(2);',
  '   });',
  "+  it('multiplies', () => {",
  '+    expect(mul(2, 3)).toBe(6);',
  '+  });',
  ' });',
].join('\n');

const testFile = (over: Partial<DiffFile> = {}): DiffFile => ({
  path: 'src/math.test.ts',
  change: 'modified',
  additions: 4,
  deletions: 1,
  isBinary: false,
  patch: SPEC_PATCH,
  ...over,
});

describe('createTestFileView', () => {
  it('lists each changed case with its status', async () => {
    const view = await createTestFileView(testFile());
    const items = [...view.querySelectorAll('.triage-case')].map((b) => ({
      status: b.querySelector('.triage-case__status')?.textContent,
      title: b.querySelector('.triage-case__title')?.textContent,
    }));
    expect(items).toEqual([
      { status: 'changed', title: 'adds' },
      { status: 'added', title: 'multiplies' },
    ]);
  });

  it('renders the file diff alongside the case list', async () => {
    const view = await createTestFileView(testFile());
    expect(view.querySelector('.triage-diff__row')).not.toBeNull();
  });

  it('scrolls to the matching diff row when a case is clicked', async () => {
    // jsdom doesn't implement scrollIntoView; install a stub to observe the call.
    const scrollFn = vi.fn();
    const proto = HTMLElement.prototype as unknown as { scrollIntoView?: () => void };
    proto.scrollIntoView = scrollFn;
    try {
      const view = await createTestFileView(testFile());
      const addedCase = view.querySelector('.triage-case--added') as HTMLButtonElement;
      addedCase.click();
      expect(scrollFn).toHaveBeenCalledOnce();
      expect(view.querySelector('.triage-diff__row--active')?.textContent).toContain('multiplies');
    } finally {
      proto.scrollIntoView = undefined;
    }
  });

  it('renders just the diff when there are no parsable cases', async () => {
    const view = await createTestFileView(
      testFile({ patch: '@@ -1 +1 @@\n-const a = 1;\n+const a = 2;' }),
    );
    expect(view.querySelector('.triage-cases')).toBeNull();
    expect(view.querySelector('.triage-diff__row')).not.toBeNull();
  });
});
