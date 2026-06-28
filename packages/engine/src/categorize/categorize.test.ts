import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../diff/model.js';
import { categorize } from './categorize.js';
import type { CategoryId } from './model.js';

const file = (path: string, additions = 1, deletions = 0): DiffFile => ({
  path,
  change: 'modified',
  additions,
  deletions,
  isBinary: false,
  patch: '@@',
});

/** Categorize a single path and return its bucket id. */
const idOf = (path: string): CategoryId | undefined => categorize([file(path)])[0]?.id;

describe('categorize', () => {
  it('buckets dependencies (manifests + lockfiles)', () => {
    expect(idOf('package.json')).toBe('dependencies');
    expect(idOf('apps/web/package.json')).toBe('dependencies');
    expect(idOf('pnpm-lock.yaml')).toBe('dependencies');
    expect(idOf('Cargo.toml')).toBe('dependencies');
  });

  it('buckets harness files', () => {
    expect(idOf('CLAUDE.md')).toBe('harness');
    expect(idOf('.claude/rules/git.md')).toBe('harness');
    expect(idOf('.mcp.json')).toBe('harness');
    expect(idOf('.github/copilot-instructions.md')).toBe('harness');
  });

  it('buckets CI files', () => {
    expect(idOf('.github/workflows/ci.yml')).toBe('ci');
    expect(idOf('.github/actions/setup/action.yml')).toBe('ci');
    expect(idOf('.gitlab-ci.yml')).toBe('ci');
    expect(idOf('Jenkinsfile')).toBe('ci');
  });

  it('buckets config files', () => {
    expect(idOf('tsconfig.json')).toBe('config');
    expect(idOf('biome.json')).toBe('config');
    expect(idOf('vite.config.ts')).toBe('config');
    expect(idOf('.eslintrc.cjs')).toBe('config');
    expect(idOf('Dockerfile')).toBe('config');
    expect(idOf('.env.production')).toBe('config');
  });

  it('buckets tests', () => {
    expect(idOf('src/app.test.ts')).toBe('tests');
    expect(idOf('src/app.spec.tsx')).toBe('tests');
    expect(idOf('src/Button.stories.tsx')).toBe('tests');
    expect(idOf('src/__tests__/helper.ts')).toBe('tests');
    expect(idOf('e2e/login.ts')).toBe('tests');
  });

  it('buckets docs', () => {
    expect(idOf('README.md')).toBe('docs');
    expect(idOf('docs/architecture.mdx')).toBe('docs');
    expect(idOf('CHANGELOG.md')).toBe('docs');
  });

  it('buckets everything else as code', () => {
    expect(idOf('src/app.ts')).toBe('code');
    expect(idOf('packages/engine/src/index.ts')).toBe('code');
    expect(idOf('logo.png')).toBe('code');
  });

  it('first match wins: CI beats Tests for a workflow named *.test.yml', () => {
    expect(idOf('.github/workflows/deploy.test.yml')).toBe('ci');
  });

  it('first match wins: Harness beats Docs for CLAUDE.md', () => {
    expect(idOf('CLAUDE.md')).toBe('harness');
  });

  it('first match wins: Config beats Tests for vitest.config.ts', () => {
    expect(idOf('vitest.config.ts')).toBe('config');
  });

  it('returns buckets in canonical review order, skipping empties', () => {
    const result = categorize([
      file('src/app.ts'),
      file('README.md'),
      file('package.json'),
      file('src/app.test.ts'),
    ]);
    expect(result.map((c) => c.id)).toEqual(['dependencies', 'tests', 'docs', 'code']);
  });

  it('sums fileCount and churn per bucket', () => {
    const result = categorize([
      file('a.test.ts', 3, 1),
      file('b.test.ts', 2, 4),
      file('src/x.ts', 10, 0),
    ]);
    const tests = result.find((c) => c.id === 'tests');
    expect(tests?.fileCount).toBe(2);
    expect(tests?.additions).toBe(5);
    expect(tests?.deletions).toBe(5);
  });

  it('places every file in exactly one bucket', () => {
    const paths = [
      'package.json',
      'CLAUDE.md',
      '.github/workflows/ci.yml',
      'tsconfig.json',
      'a.test.ts',
      'README.md',
      'src/app.ts',
    ];
    const result = categorize(paths.map((p) => file(p)));
    const total = result.reduce((n, c) => n + c.fileCount, 0);
    expect(total).toBe(paths.length);
  });

  it('returns an empty array for no files', () => {
    expect(categorize([])).toEqual([]);
  });
});
