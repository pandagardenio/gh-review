import type { DiffFile, PullRequestDiff } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { createReviewFlow } from './review-flow.js';

const file = (path: string): DiffFile => ({
  path,
  change: 'modified',
  additions: 1,
  deletions: 0,
  isBinary: false,
  patch: '@@ -1 +1 @@\n-a\n+b',
});

const diff = (paths: string[]): PullRequestDiff => ({
  owner: 'octo',
  repo: 'repo',
  number: 1,
  headSha: 'sha',
  files: paths.map(file),
});

const setup = () => diff(['tsconfig.json', 'src/a.ts', 'src/b.ts']);

const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement;

describe('createReviewFlow', () => {
  it('renders a section per category with independent collapse', () => {
    const { element } = createReviewFlow(setup());
    const config = q(element, '.triage-section--config .triage-section__files');
    const code = q(element, '.triage-section--code .triage-section__files');
    // Code collapsed by default; Config open.
    expect(code.hidden).toBe(true);
    expect(config.hidden).toBe(false);

    q(element, '.triage-section--code .triage-section__toggle').click();
    expect(code.hidden).toBe(false); // toggled independently
    expect(config.hidden).toBe(false); // unaffected
  });

  it('shows overall and per-section progress, updated on view', () => {
    const { element } = createReviewFlow(setup());
    expect(q(element, '.triage-review__overall').textContent).toBe('0/3');
    expect(q(element, '.triage-section--code .triage-section__progress').textContent).toBe('0/2');

    const firstCodeFile = q(
      element,
      '.triage-section--code .triage-file__viewed',
    ) as HTMLInputElement;
    firstCodeFile.checked = true;
    firstCodeFile.dispatchEvent(new Event('change'));

    expect(q(element, '.triage-section--code .triage-section__progress').textContent).toBe('1/2');
    expect(q(element, '.triage-review__overall').textContent).toBe('1/3');
  });

  it('marks a whole section viewed and updates progress', () => {
    const { element, getState } = createReviewFlow(setup());
    const sectionCheck = q(
      element,
      '.triage-section--code .triage-section__viewed',
    ) as HTMLInputElement;
    sectionCheck.checked = true;
    sectionCheck.dispatchEvent(new Event('change'));

    expect(q(element, '.triage-section--code .triage-section__progress').textContent).toBe('2/2');
    expect(getState().viewedPaths).toEqual(['src/a.ts', 'src/b.ts']);
    // Each file checkbox reflects the block action.
    const fileChecks = element.querySelectorAll<HTMLInputElement>(
      '.triage-section--code .triage-file__viewed',
    );
    expect([...fileChecks].every((c) => c.checked)).toBe(true);
  });

  it('renders each file diff lazily on expand (reviewable inside Triage)', async () => {
    const { element } = createReviewFlow(setup());
    const codeFile = q(element, '.triage-section--code .triage-file');
    expect(codeFile.querySelector('.triage-diff__row')).toBeNull(); // not yet rendered

    q(codeFile, '.triage-file__expand').click();
    await Promise.resolve(); // let the async reveal settle
    await Promise.resolve();
    expect(codeFile.querySelectorAll('.triage-diff__row').length).toBeGreaterThan(0);
  });

  it('restores prior viewed state and exposes it serializable', () => {
    const { element, getState } = createReviewFlow(setup(), {
      initialState: { viewedPaths: ['src/a.ts'] },
    });
    expect(q(element, '.triage-review__overall').textContent).toBe('1/3');
    expect(getState().viewedPaths).toEqual(['src/a.ts']);
  });
});
