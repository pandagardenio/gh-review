import type { DiffFile } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { dependencyRows } from './dependency-rows.js';

const pkg = (patch?: string, path = 'package.json'): DiffFile => ({
  path,
  change: 'modified',
  additions: 1,
  deletions: 1,
  isBinary: false,
  patch,
});

const MIXED_PATCH = [
  '@@ -1,6 +1,6 @@',
  '   "dependencies": {',
  '     "axios": "^1.4.0",',
  '-    "react": "^18.0.0",',
  '+    "react": "^18.2.0",',
  '+    "zod": "^3.22.0",',
  '-    "left-pad": "^1.0.0"',
  '   }',
].join('\n');

describe('dependencyRows', () => {
  it('renders a row per dependency change', () => {
    const list = dependencyRows(pkg(MIXED_PATCH));
    expect(list).not.toBeNull();
    const names = [...(list?.querySelectorAll('.triage-dep__name') ?? [])].map(
      (n) => n.textContent,
    );
    expect(names).toEqual(['left-pad', 'react', 'zod']);
  });

  it('shows old → new for a bump', () => {
    const list = dependencyRows(pkg(MIXED_PATCH));
    const bump = list?.querySelector('.triage-dep--bumped .triage-dep__ver');
    expect(bump?.textContent).toBe('^18.0.0 → ^18.2.0');
  });

  it('returns null for a non-package.json file', () => {
    expect(dependencyRows(pkg(MIXED_PATCH, 'src/app.ts'))).toBeNull();
  });

  it('returns null when there is no patch', () => {
    expect(dependencyRows(pkg(undefined))).toBeNull();
  });

  it('returns null for a scripts-only change (no phantom rows)', () => {
    const scriptsOnly = [
      '@@ -1,3 +1,3 @@',
      '   "scripts": {',
      '-    "build": "tsc"',
      '+    "build": "vite build"',
      '   }',
    ].join('\n');
    expect(dependencyRows(pkg(scriptsOnly))).toBeNull();
  });

  it('renders text via textContent, never parsed as HTML', () => {
    // A crafted version string must not become markup.
    const patch = [
      '@@ -1,3 +1,3 @@',
      '   "dependencies": {',
      '+    "evil": "<img src=x>"',
      '   }',
    ].join('\n');
    const list = dependencyRows(pkg(patch));
    expect(list?.querySelector('img')).toBeNull();
    expect(list?.querySelector('.triage-dep__ver')?.textContent).toBe('<img src=x>');
  });
});
