/**
 * Inline dependency-change rows for the Dependencies section (BL-005 + BL-004).
 *
 * Renders the semantic delta of a `package.json` — added / bumped / removed —
 * so the reviewer sees intent without reading a raw JSON diff (Constitution
 * principle 1). CSP-safe: built with {@link el}, text via `textContent`.
 */

import type { DependencyChange, DiffFile } from '@triage/engine';
import { parseDependencyChanges } from '@triage/engine';
import { el } from './dom.js';

const SYMBOL: Record<DependencyChange['change'], string> = {
  added: '+',
  removed: '−',
  bumped: '~',
};

/** One dependency-change row, e.g. `~ react  ^18.0.0 → ^18.2.0  (dependencies)`. */
function row(change: DependencyChange): HTMLElement {
  const version =
    change.change === 'bumped'
      ? `${change.previousVersion} → ${change.version}`
      : (change.version ?? change.previousVersion ?? '');
  return el('li', {
    class: ['triage-dep', `triage-dep--${change.change}`],
    children: [
      el('span', { class: 'triage-dep__sym', text: SYMBOL[change.change] }),
      el('span', { class: 'triage-dep__name', text: change.name }),
      el('span', { class: 'triage-dep__ver', text: version }),
      el('span', { class: 'triage-dep__kind', text: change.kind }),
    ],
  });
}

/**
 * Dependency rows for a `package.json` file, or `null` when there is nothing to
 * expand (not a `package.json`, no patch, or no dependency-section change).
 */
export function dependencyRows(file: DiffFile): HTMLElement | null {
  if (basename(file.path) !== 'package.json' || !file.patch) return null;
  const changes = parseDependencyChanges(file.patch);
  if (changes.length === 0) return null;
  return el('ul', {
    class: 'triage-deps',
    children: changes.map(row),
  });
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
