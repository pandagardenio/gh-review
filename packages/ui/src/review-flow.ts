/**
 * Sectioned review flow + viewed state (BL-007).
 *
 * Turns each category (BL-003) into a review **section** rendered with our own
 * diff (BL-006): each section collapses/expands independently, each file has its
 * own diff and "viewed" checkbox, and a block-level control marks a whole
 * section viewed. Progress shows per section and overall. This is the flow that
 * fully replaces GitHub's — the reviewer never leaves Triage (MVP.md §4.2).
 *
 * Viewed state lives in memory via the engine's serializable {@link ReviewState}
 * (BL-011 persists it unchanged). CSP-safe throughout ({@link el}).
 */

import type { DiffFile, FileCategory, PullRequestDiff, ReviewState } from '@triage/engine';
import {
  categorize,
  createReviewState,
  isFileViewed,
  overallProgress,
  sectionProgress,
  setFilesViewed,
  setFileViewed,
} from '@triage/engine';
import { lazyFileDiff } from './diff-view.js';
import { el } from './dom.js';

export interface ReviewFlowOptions {
  /** Restore prior viewed state (BL-011). */
  initialState?: ReviewState;
  /** Categories collapsed on open. Defaults to the Code section (principle 2). */
  collapsed?: ReadonlySet<string>;
}

export interface ReviewFlow {
  readonly element: HTMLElement;
  /** Current serializable viewed state — handed to BL-011 to persist. */
  getState(): ReviewState;
}

interface SectionView {
  element: HTMLElement;
  refresh(): void;
}

export function createReviewFlow(
  diff: PullRequestDiff,
  options: ReviewFlowOptions = {},
): ReviewFlow {
  const categories = categorize(diff.files);
  const collapsed = options.collapsed ?? new Set(['code']);
  let state = createReviewState(options.initialState);

  const overallLabel = el('span', { class: 'triage-review__overall' });
  const sections: SectionView[] = [];

  const refresh = (): void => {
    const overall = overallProgress(categories, state);
    overallLabel.textContent = `${overall.viewed}/${overall.total}`;
    for (const section of sections) section.refresh();
  };

  // Update viewed state then re-sync every label/checkbox.
  const update = (next: ReviewState): void => {
    state = next;
    refresh();
  };

  for (const category of categories) {
    sections.push(
      renderSection(category, collapsed.has(category.id), {
        isViewed: (path) => isFileViewed(state, path),
        setFile: (path, viewed) => update(setFileViewed(state, path, viewed)),
        setSection: (paths, viewed) => update(setFilesViewed(state, paths, viewed)),
        progress: () => sectionProgress(category, state),
      }),
    );
  }

  const element = el('section', {
    class: 'triage-review',
    attrs: { 'aria-label': 'Review' },
    children: [
      el('header', {
        class: 'triage-review__head',
        children: [el('h2', { class: 'triage-review__title', text: 'Review' }), overallLabel],
      }),
      ...sections.map((s) => s.element),
    ],
  });

  refresh();
  return { element, getState: () => state };
}

interface SectionHandlers {
  isViewed(path: string): boolean;
  setFile(path: string, viewed: boolean): void;
  setSection(paths: readonly string[], viewed: boolean): void;
  progress(): { viewed: number; total: number };
}

function renderSection(
  category: FileCategory,
  startCollapsed: boolean,
  handlers: SectionHandlers,
): SectionView {
  const progressLabel = el('span', { class: 'triage-section__progress' });

  const sectionCheck = el('input', {
    class: 'triage-section__viewed',
    attrs: { type: 'checkbox', 'aria-label': `Mark ${category.label} reviewed` },
    on: {
      change: () =>
        handlers.setSection(
          category.files.map((f) => f.path),
          sectionCheck.checked,
        ),
    },
  });

  const files = category.files.map((file) => renderFile(file, handlers));
  const body = el('ul', { class: 'triage-section__files', children: files.map((f) => f.element) });
  body.hidden = startCollapsed;

  const toggle = el('button', {
    class: 'triage-section__toggle',
    attrs: { type: 'button', 'aria-expanded': String(!startCollapsed) },
    children: [el('span', { class: 'triage-section__label', text: category.label }), progressLabel],
    on: {
      click: () => {
        body.hidden = !body.hidden;
        toggle.setAttribute('aria-expanded', String(!body.hidden));
      },
    },
  });

  const refresh = (): void => {
    const p = handlers.progress();
    progressLabel.textContent = `${p.viewed}/${p.total}`;
    sectionCheck.checked = p.total > 0 && p.viewed === p.total;
    for (const f of files) f.refresh();
  };

  const element = el('section', {
    class: ['triage-section', `triage-section--${category.id}`],
    children: [
      el('div', { class: 'triage-section__head', children: [toggle, sectionCheck] }),
      body,
    ],
  });

  return { element, refresh };
}

interface FileView {
  element: HTMLElement;
  refresh(): void;
}

function renderFile(file: DiffFile, handlers: SectionHandlers): FileView {
  const { element: diff, reveal } = lazyFileDiff(file);
  diff.hidden = true;

  const check = el('input', {
    class: 'triage-file__viewed',
    attrs: { type: 'checkbox', 'aria-label': `Mark ${file.path} viewed` },
    on: { change: () => handlers.setFile(file.path, check.checked) },
  });

  const expand = el('button', {
    class: 'triage-file__expand',
    attrs: { type: 'button', 'aria-expanded': 'false' },
    text: file.path,
    on: {
      click: () => {
        diff.hidden = !diff.hidden;
        expand.setAttribute('aria-expanded', String(!diff.hidden));
        if (!diff.hidden) void reveal();
      },
    },
  });

  const refresh = (): void => {
    check.checked = handlers.isViewed(file.path);
  };

  const element = el('li', {
    class: 'triage-file',
    children: [el('div', { class: 'triage-file__head', children: [expand, check] }), diff],
  });

  return { element, refresh };
}
