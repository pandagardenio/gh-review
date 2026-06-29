/**
 * Implementation focus (BL-009): from a test file, resolve the sibling file
 * under test and decide where to jump.
 *
 * Heuristic, path-only (MVP.md §4.3) — `.test.`/`.spec.` infixes and the
 * `__tests__/` directory shape. When nothing resolves we return `null` so the
 * caller surfaces that plainly rather than guessing a wrong target (principle 5).
 * Symbol-level "go to the exact function" is deferred (MVP.md §2).
 */

import type { PullRequestDiff } from '../diff/model.js';

const INFIX = /^(.*)\.(test|spec)\.([^.]+)$/;
const TEST_DIR = '__tests__';

/**
 * Resolve the sibling implementation path for a test path, or `null` when the
 * path isn't a recognizable test file.
 *
 *   `x.spec.ts`              → `x.ts`
 *   `src/x.test.tsx`         → `src/x.tsx`
 *   `src/__tests__/x.test.ts`→ `src/x.ts`   (the `../x.ts` sibling)
 */
export function resolveImplementationPath(testPath: string): string | null {
  const parts = testPath.split('/');
  const file = parts.pop() ?? '';
  const dir = parts;

  const infix = INFIX.exec(file);
  const implFile = infix ? `${infix[1]}.${infix[3]}` : file;

  const testDirIndex = dir.lastIndexOf(TEST_DIR);
  const hasTestDir = testDirIndex !== -1;

  // Not a test file by either signal — nothing to resolve.
  if (!infix && !hasTestDir) return null;

  const implDir = hasTestDir ? dir.filter((_, i) => i !== testDirIndex) : dir;
  return [...implDir, implFile].join('/');
}

/** Where an implementation jump should land. */
export type ImplementationTarget =
  | { readonly path: string; readonly location: 'in-pr' }
  | { readonly path: string; readonly location: 'external'; readonly url: string };

/**
 * Resolve the implementation target for a test path against a loaded PR: the
 * Triage diff when the file is in the PR (BL-007), else its blob on the PR's
 * head branch (native GitHub). `null` when no sibling resolves.
 */
export function implementationTarget(
  testPath: string,
  diff: PullRequestDiff,
): ImplementationTarget | null {
  const path = resolveImplementationPath(testPath);
  if (path === null) return null;
  if (diff.files.some((file) => file.path === path)) {
    return { path, location: 'in-pr' };
  }
  const url = `https://github.com/${diff.owner}/${diff.repo}/blob/${diff.headSha}/${path}`;
  return { path, location: 'external', url };
}
