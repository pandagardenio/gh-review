/**
 * The Triage panel (BL-005): a categorized navigator over a PR's changed files.
 *
 * Built CSP-safe with {@link el} (createElement + CSSOM + addEventListener) — no
 * `innerHTML`, no inline `style=`/`on*` (MVP.md §6). Serves Constitution
 * principle 1 (move attention to where risk concentrates) and principle 2
 * (de-emphasize, never hide: the Code section is **collapsed by default, never
 * removed**, and every file stays reachable).
 *
 * Each file links to GitHub's native `#diff-<sha256(path)>` anchor (BL-005), so
 * clicking scrolls the virtualized native diff without scraping its DOM.
 */

import type { DiffFile, FileCategory, PullRequestDiff } from '@triage/engine';
import { categorize } from '@triage/engine';
import { diffAnchorHref } from './anchor.js';
import { dependencyRows } from './dependency-rows.js';
import { el } from './dom.js';

export interface TriagePanelOptions {
  /** Heading text. Defaults to "Triage". */
  title?: string;
}

/** Categories that start collapsed — de-emphasized, never hidden (principle 2). */
const COLLAPSED_BY_DEFAULT = new Set(['code']);

/**
 * Build the panel for a loaded {@link PullRequestDiff}. Async because file
 * anchors are SHA-256 hashes computed with Web Crypto; the entry shell awaits
 * it and mounts the returned element.
 */
export async function createTriagePanel(
  diff: PullRequestDiff,
  options: TriagePanelOptions = {},
): Promise<HTMLElement> {
  const categories = categorize(diff.files);
  const sections = await Promise.all(categories.map(renderSection));

  return el('section', {
    class: 'triage-panel',
    attrs: { 'aria-label': 'Triage' },
    children: [
      el('header', {
        class: 'triage-panel__head',
        children: [
          el('h2', { class: 'triage-panel__title', text: options.title ?? 'Triage' }),
          el('span', {
            class: 'triage-panel__count',
            text: fileCountLabel(diff.files.length),
          }),
        ],
      }),
      ...sections,
    ],
  });
}

async function renderSection(category: FileCategory): Promise<HTMLElement> {
  const collapsed = COLLAPSED_BY_DEFAULT.has(category.id);
  const rows = await Promise.all(category.files.map((file) => renderFile(category, file)));

  const list = el('ul', { class: 'triage-section__files', children: rows });
  list.hidden = collapsed;

  const toggle = el('button', {
    class: 'triage-section__toggle',
    attrs: {
      type: 'button',
      'aria-expanded': String(!collapsed),
    },
    children: [
      el('span', { class: 'triage-section__label', text: category.label }),
      el('span', { class: 'triage-section__count', text: String(category.fileCount) }),
      el('span', { class: 'triage-section__churn', text: churnLabel(category) }),
    ],
    on: {
      click: () => {
        const next = list.hidden;
        list.hidden = !next;
        toggle.setAttribute('aria-expanded', String(next));
      },
    },
  });

  return el('section', {
    class: ['triage-section', `triage-section--${category.id}`],
    children: [toggle, list],
  });
}

async function renderFile(category: FileCategory, file: DiffFile): Promise<HTMLElement> {
  const href = await diffAnchorHref(file.path);
  const children: (Node | string)[] = [
    el('a', {
      class: 'triage-file__link',
      attrs: { href },
      text: file.path,
    }),
    el('span', { class: 'triage-file__churn', text: churnLabel(file) }),
  ];

  // Inline dependency expansion within the Dependencies section (BL-004).
  if (category.id === 'dependencies') {
    const rows = dependencyRows(file);
    if (rows) children.push(rows);
  }

  return el('li', { class: 'triage-file', children });
}

function churnLabel(churn: { additions: number; deletions: number }): string {
  return `+${churn.additions} −${churn.deletions}`;
}

function fileCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}
