/**
 * Test-file view (BL-008): a preview of the test cases added / deleted / changed
 * in a spec, above the file's rendered diff (BL-006). Clicking a case scrolls to
 * it in the diff. Serves Constitution principle 1 (tests are intent-bearing —
 * show what behaviour changed). CSP-safe ({@link el}); degrades quietly when no
 * case is parsed (principle 5).
 */

import type { DiffFile, PullRequestDiff, TestCase } from '@triage/engine';
import { parseTestCases } from '@triage/engine';
import { renderFileDiff } from './diff-view.js';
import { el } from './dom.js';
import {
  createImplementationFocus,
  type ImplementationFocusOptions,
} from './implementation-focus.js';

const STATUS_LABEL: Record<TestCase['status'], string> = {
  added: 'added',
  deleted: 'deleted',
  changed: 'changed',
};

export interface TestFileViewOptions extends ImplementationFocusOptions {
  /** When given, prepend the implementation-focus jump (BL-009). */
  diff?: PullRequestDiff;
}

/** Render the case list (if any) plus the test file's diff, wired for scroll. */
export async function createTestFileView(
  file: DiffFile,
  options: TestFileViewOptions = {},
): Promise<HTMLElement> {
  const diff = await renderFileDiff(file);
  const cases = parseTestCases(file.patch ?? '');

  const children: HTMLElement[] = [];
  if (options.diff) {
    children.push(createImplementationFocus(file.path, options.diff, options));
  }
  if (cases.length > 0) children.push(renderCaseList(cases, diff));
  children.push(diff);

  return el('div', { class: 'triage-testfile', children });
}

function renderCaseList(cases: readonly TestCase[], diff: HTMLElement): HTMLElement {
  return el('ul', {
    class: 'triage-cases',
    children: cases.map((testCase) => renderCase(testCase, diff)),
  });
}

function renderCase(testCase: TestCase, diff: HTMLElement): HTMLElement {
  const target = findCaseRow(diff, testCase.title);
  const button = el('button', {
    class: ['triage-case', `triage-case--${testCase.status}`],
    attrs: { type: 'button', ...(target ? {} : { disabled: 'true' }) },
    children: [
      el('span', { class: 'triage-case__status', text: STATUS_LABEL[testCase.status] }),
      el('span', { class: 'triage-case__title', text: testCase.title }),
    ],
    on: {
      click: () => {
        if (!target) return;
        target.scrollIntoView?.({ block: 'center' });
        highlight(diff, target);
      },
    },
  });
  return el('li', { class: 'triage-cases__item', children: [button] });
}

/** First rendered diff row whose content contains the case title. */
function findCaseRow(diff: HTMLElement, title: string): HTMLElement | null {
  for (const row of diff.querySelectorAll<HTMLElement>('.triage-diff__row')) {
    const content = row.querySelector('.triage-diff__content')?.textContent ?? '';
    if (content.includes(title)) return row;
  }
  return null;
}

function highlight(diff: HTMLElement, row: HTMLElement): void {
  for (const prev of diff.querySelectorAll('.triage-diff__row--active')) {
    prev.classList.remove('triage-diff__row--active');
  }
  row.classList.add('triage-diff__row--active');
}
