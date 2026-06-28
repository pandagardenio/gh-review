import { describe, expect, it } from 'vitest';
import { parseDependencyChanges } from './parse.js';

describe('parseDependencyChanges', () => {
  it('detects added, bumped, and removed across a mixed patch', () => {
    const patch = [
      '@@ -1,8 +1,8 @@',
      ' {',
      '   "dependencies": {',
      '     "axios": "^1.4.0",',
      '-    "left-pad": "^1.0.0",',
      '-    "react": "^18.0.0",',
      '+    "react": "^18.2.0",',
      '+    "zod": "^3.22.0",',
      '     "vue": "^3.0.0"',
      '   }',
      ' }',
    ].join('\n');

    const changes = parseDependencyChanges(patch);
    expect(changes).toEqual([
      { name: 'left-pad', kind: 'dependencies', change: 'removed', previousVersion: '^1.0.0' },
      {
        name: 'react',
        kind: 'dependencies',
        change: 'bumped',
        previousVersion: '^18.0.0',
        version: '^18.2.0',
      },
      { name: 'zod', kind: 'dependencies', change: 'added', version: '^3.22.0' },
    ]);
  });

  it('does not report unchanged context dependencies', () => {
    const patch = [
      '@@ -1,5 +1,5 @@',
      '   "dependencies": {',
      '     "axios": "^1.4.0",',
      '-    "react": "^18.0.0"',
      '+    "react": "^18.2.0"',
      '   }',
    ].join('\n');
    const changes = parseDependencyChanges(patch);
    expect(changes.map((c) => c.name)).toEqual(['react']);
  });

  it('separates the four dependency sections', () => {
    const patch = [
      '@@ -1,12 +1,12 @@',
      '   "dependencies": {',
      '+    "a": "1.0.0"',
      '   },',
      '   "devDependencies": {',
      '+    "b": "2.0.0"',
      '   },',
      '   "peerDependencies": {',
      '-    "c": "3.0.0"',
      '   },',
      '   "optionalDependencies": {',
      '+    "d": "4.0.0"',
      '   }',
    ].join('\n');
    const changes = parseDependencyChanges(patch);
    expect(changes).toEqual([
      { name: 'a', kind: 'dependencies', change: 'added', version: '1.0.0' },
      { name: 'b', kind: 'devDependencies', change: 'added', version: '2.0.0' },
      { name: 'c', kind: 'peerDependencies', change: 'removed', previousVersion: '3.0.0' },
      { name: 'd', kind: 'optionalDependencies', change: 'added', version: '4.0.0' },
    ]);
  });

  it('ignores non-dependency fields (no phantom rows for a scripts-only change)', () => {
    const patch = [
      '@@ -1,5 +1,5 @@',
      '   "scripts": {',
      '-    "build": "tsc"',
      '+    "build": "vite build"',
      '   }',
    ].join('\n');
    expect(parseDependencyChanges(patch)).toEqual([]);
  });

  it('does not attribute entries once a section closes', () => {
    const patch = [
      '@@ -1,6 +1,6 @@',
      '   "dependencies": {',
      '     "axios": "^1.4.0"',
      '   },',
      '   "scripts": {',
      '+    "axios": "this is a script, not a dep"',
      '   }',
    ].join('\n');
    expect(parseDependencyChanges(patch)).toEqual([]);
  });

  it('returns nothing when the section header is out of the hunk (safe miss, no phantom)', () => {
    // The changed line has no visible enclosing section opener.
    const patch = [
      '@@ -10,3 +10,3 @@',
      '     "axios": "^1.4.0",',
      '-    "react": "^18.0.0"',
      '+    "react": "^18.2.0"',
    ].join('\n');
    expect(parseDependencyChanges(patch)).toEqual([]);
  });

  it('returns an empty list for an empty patch', () => {
    expect(parseDependencyChanges('')).toEqual([]);
  });
});
