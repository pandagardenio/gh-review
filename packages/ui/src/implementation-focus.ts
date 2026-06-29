/**
 * Implementation-focus control (BL-009): from a test file, a jump to the file
 * under test. Moves attention from the test to the implementation it exercises
 * (Constitution principle 1). CSP-safe ({@link el}).
 *
 * - **In-PR** target → a button that calls `onOpenInPr(path)` so the host can
 *   reveal that file's Triage diff (BL-007).
 * - **External** target → a native anchor to the file on the PR's head branch.
 * - **No sibling** resolves → a plain, muted notice rather than a wrong guess
 *   (principle 5).
 */

import type { PullRequestDiff } from '@triage/engine';
import { implementationTarget } from '@triage/engine';
import { el } from './dom.js';

export interface ImplementationFocusOptions {
  /** Called with the in-PR implementation path so the host jumps to its diff. */
  onOpenInPr?: (path: string) => void;
}

/** Build the implementation-focus affordance for a test file. */
export function createImplementationFocus(
  testPath: string,
  diff: PullRequestDiff,
  options: ImplementationFocusOptions = {},
): HTMLElement {
  const target = implementationTarget(testPath, diff);

  if (target === null) {
    return el('div', {
      class: ['triage-impl', 'triage-impl--none'],
      text: 'No implementation file resolved.',
    });
  }

  if (target.location === 'external') {
    return el('div', {
      class: ['triage-impl', 'triage-impl--external'],
      children: [
        el('a', {
          class: 'triage-impl__link',
          attrs: { href: target.url, target: '_blank', rel: 'noreferrer' },
          text: `Open implementation: ${target.path}`,
        }),
      ],
    });
  }

  return el('div', {
    class: ['triage-impl', 'triage-impl--in-pr'],
    children: [
      el('button', {
        class: 'triage-impl__open',
        attrs: { type: 'button' },
        text: `Focus implementation: ${target.path}`,
        on: { click: () => options.onOpenInPr?.(target.path) },
      }),
    ],
  });
}
