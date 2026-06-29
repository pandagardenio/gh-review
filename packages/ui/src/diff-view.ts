/**
 * Unified diff renderer (BL-006).
 *
 * Renders a file's `patch` as a single-column monospace diff inside Triage's
 * surface — we render it ourselves because GitHub's diff view is virtualized
 * (MVP.md §4.2). CSP-safe: built with {@link el} (createElement + CSSOM +
 * addEventListener), text via `textContent`. Serves Constitution principle 3
 * (augment, don't replace) and principle 5 (patch-less files degrade
 * gracefully, never an empty/broken view).
 *
 * Rendering is **lazy** per file ({@link lazyFileDiff}) so a large PR doesn't
 * recreate the perf problem virtualization solved (MVP.md §7).
 */

import type { DiffFile, DiffHunk, DiffLine } from '@triage/engine';
import { parseHunks } from '@triage/engine';
import { diffAnchorHref } from './anchor.js';
import { el } from './dom.js';

const MARKER: Record<DiffLine['kind'], string> = {
  context: ' ',
  add: '+',
  remove: '-',
};

/** Render the full unified diff for a file, or a graceful patch-less affordance. */
export async function renderFileDiff(file: DiffFile): Promise<HTMLElement> {
  if (file.isBinary || !file.patch) return patchlessNotice(file);

  const hunks = parseHunks(file.patch);
  if (hunks.length === 0) return patchlessNotice(file);

  const root = el('div', { class: 'triage-diff', style: { fontFamily: 'monospace' } });
  for (const hunk of hunks) root.append(renderHunk(hunk));
  return root;
}

/**
 * Lazy variant: returns an empty placeholder plus a `reveal()` that renders the
 * diff into it once (idempotent). The section flow (BL-007) calls `reveal()`
 * when a file is expanded so off-screen files cost nothing.
 */
export function lazyFileDiff(file: DiffFile): {
  element: HTMLElement;
  reveal: () => Promise<void>;
} {
  const element = el('div', { class: 'triage-diff--lazy' });
  let revealed = false;
  const reveal = async (): Promise<void> => {
    if (revealed) return;
    revealed = true;
    element.append(await renderFileDiff(file));
  };
  return { element, reveal };
}

function renderHunk(hunk: DiffHunk): HTMLElement {
  const head = el('div', {
    class: 'triage-diff__hunk',
    text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@${
      hunk.section ? ` ${hunk.section}` : ''
    }`,
  });
  return el('div', {
    class: 'triage-diff__hunk-group',
    children: [head, ...hunk.lines.map(renderLine)],
  });
}

function renderLine(line: DiffLine): HTMLElement {
  return el('div', {
    class: ['triage-diff__row', `triage-diff__row--${line.kind}`],
    style: { whiteSpace: 'pre' },
    attrs: {
      // Line + side data anchors comments later (BL-010).
      'data-old-line': line.oldLine === undefined ? '' : String(line.oldLine),
      'data-new-line': line.newLine === undefined ? '' : String(line.newLine),
    },
    children: [
      el('span', {
        class: ['triage-diff__gutter', 'triage-diff__gutter--old'],
        text: numberText(line.oldLine),
      }),
      el('span', {
        class: ['triage-diff__gutter', 'triage-diff__gutter--new'],
        text: numberText(line.newLine),
      }),
      el('span', { class: 'triage-diff__marker', text: MARKER[line.kind] }),
      el('span', { class: 'triage-diff__content', text: line.content }),
    ],
  });
}

function numberText(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}

async function patchlessNotice(file: DiffFile): Promise<HTMLElement> {
  return el('div', {
    class: ['triage-diff', 'triage-diff--patchless'],
    children: [
      el('span', {
        class: 'triage-diff__notice',
        text: file.isBinary ? 'Binary file — no inline diff.' : 'No inline diff available.',
      }),
      el('a', {
        class: 'triage-diff__open',
        attrs: { href: await diffAnchorHref(file.path) },
        text: 'Open on GitHub',
      }),
    ],
  });
}
