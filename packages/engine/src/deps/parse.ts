/**
 * Parse a `package.json` **patch** into per-dependency deltas (BL-004).
 *
 * We read the patch, never re-fetch file contents, to stay within the loaded
 * diff model (BL-002). The patch is reconstructed into an *old* side (context +
 * removed lines) and a *new* side (context + added lines); each side is scanned
 * for `"name": "version"` entries under a known dependency section, and the two
 * are compared.
 *
 * Section attribution resets at every hunk header: a line is only treated as a
 * dependency when its enclosing `"dependencies": {` (etc.) opener is visible in
 * the same hunk. This is the safe failure direction — a change whose section
 * header is out of context is missed, never mis-reported as a phantom row (a
 * `scripts`-only edit yields nothing). MVP scope is `package.json` only.
 */

import type { DependencyChange, DependencyKind } from './model.js';

const KINDS: readonly DependencyKind[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const SECTION_OPEN =
  /"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:\s*\{/;
const SECTION_CLOSE = /^\s*\}/;
const ENTRY = /^\s*"([^"]+)"\s*:\s*"([^"]*)"/;

type Side = 'old' | 'new';
type SectionMap = Map<DependencyKind, Map<string, string>>;

/** Collect `kind → (name → version)` for one side of the patch. */
function collectEntries(patch: string, side: Side): SectionMap {
  const entries: SectionMap = new Map(KINDS.map((k) => [k, new Map<string, string>()]));
  let section: DependencyKind | null = null;

  for (const line of patch.split('\n')) {
    if (line.length === 0) continue;
    const marker = line[0];
    if (line.startsWith('@@')) {
      section = null;
      continue;
    }
    // Skip the side that does not see this line; '+' is new-only, '-' is old-only.
    if (marker === '+' && side === 'old') continue;
    if (marker === '-' && side === 'new') continue;
    if (marker !== '+' && marker !== '-' && marker !== ' ') continue;

    const content = line.slice(1);
    const open = SECTION_OPEN.exec(content);
    if (open) {
      section = open[1] as DependencyKind;
      continue;
    }
    if (!section) continue;
    if (SECTION_CLOSE.test(content)) {
      section = null;
      continue;
    }
    const entry = ENTRY.exec(content);
    if (entry) entries.get(section)?.set(entry[1] as string, entry[2] as string);
  }
  return entries;
}

/** Compute the ordered added/bumped/removed dependency changes from a patch. */
export function parseDependencyChanges(patch: string): DependencyChange[] {
  const before = collectEntries(patch, 'old');
  const after = collectEntries(patch, 'new');
  const changes: DependencyChange[] = [];

  for (const kind of KINDS) {
    const oldMap = before.get(kind) ?? new Map<string, string>();
    const newMap = after.get(kind) ?? new Map<string, string>();
    const names = new Set([...oldMap.keys(), ...newMap.keys()]);

    for (const name of [...names].sort()) {
      const previousVersion = oldMap.get(name);
      const version = newMap.get(name);
      if (previousVersion === undefined && version !== undefined) {
        changes.push({ name, kind, change: 'added', version });
      } else if (previousVersion !== undefined && version === undefined) {
        changes.push({ name, kind, change: 'removed', previousVersion });
      } else if (
        previousVersion !== undefined &&
        version !== undefined &&
        previousVersion !== version
      ) {
        changes.push({ name, kind, change: 'bumped', previousVersion, version });
      }
      // Equal versions on both sides = an unchanged context line; not a change.
    }
  }
  return changes;
}
