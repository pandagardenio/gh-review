/**
 * The ordered categorization rules (BL-003) — **product surface**.
 *
 * First match wins, top to bottom; the order *is* the review order (MVP.md §3).
 * Edit this array to change how a PR is triaged — a product decision measured
 * against Constitution principle 1, never a throwaway tweak. `code` is the
 * implicit catch-all at the bottom and matches everything else.
 */

import type { CategoryRule } from './model.js';

const base = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** True when `dir` appears as a path segment (e.g. `__tests__` in `a/__tests__/b`). */
const hasSegment = (path: string, dir: string): boolean => path.split('/').includes(dir);

/** True when one of the consecutive segments `a/b` appears in the path. */
const hasPath = (path: string, fragment: string): boolean =>
  path === fragment || path.startsWith(`${fragment}/`) || path.includes(`/${fragment}/`);

const anyBase = (path: string, names: readonly string[]): boolean => names.includes(base(path));

const LOCKFILES = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
  'go.sum',
];

const MANIFESTS = [
  'package.json',
  'pnpm-workspace.yaml',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'Pipfile',
  'composer.json',
  'pubspec.yaml',
];

const CONFIG_BASES = [
  'biome.json',
  'biome.jsonc',
  '.editorconfig',
  '.nvmrc',
  '.npmrc',
  '.gitignore',
  '.gitattributes',
  'Dockerfile',
  '.dockerignore',
];

// Filename stems that mark a config file regardless of extension.
const CONFIG_STEMS = [
  'tsconfig',
  'jsconfig',
  'vite.config',
  'vitest.config',
  'webpack.config',
  'rollup.config',
  'esbuild.config',
  'babel.config',
  'jest.config',
  'jest.setup',
  'playwright.config',
  'cypress.config',
  'karma.conf',
  'next.config',
  'nuxt.config',
  'svelte.config',
  'astro.config',
  'remix.config',
  'tailwind.config',
  'postcss.config',
  'turbo',
];

const isManifest = (path: string): boolean =>
  anyBase(path, MANIFESTS) || anyBase(path, LOCKFILES) || /^requirements.*\.txt$/.test(base(path));

const isHarness = (path: string): boolean => {
  const b = base(path);
  return (
    anyBase(path, ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.mcp.json']) ||
    hasSegment(path, '.claude') ||
    hasSegment(path, '.cursor') ||
    hasSegment(path, '.windsurf') ||
    b === '.cursorrules' ||
    b === '.windsurfrules' ||
    b === '.clinerules' ||
    hasSegment(path, '.clinerules') ||
    b === 'copilot-instructions.md'
  );
};

const isCi = (path: string): boolean =>
  hasPath(path, '.github/workflows') ||
  hasPath(path, '.github/actions') ||
  hasSegment(path, '.circleci') ||
  hasSegment(path, '.buildkite') ||
  /^(\.gitlab-ci\.yml|\.travis\.yml|\.drone\.yml|azure-pipelines\.yml|bitbucket-pipelines\.yml|Jenkinsfile)$/.test(
    base(path),
  );

const isConfig = (path: string): boolean => {
  const b = base(path);
  const stem = b.replace(/\.[^.]+$/, '');
  return (
    anyBase(path, CONFIG_BASES) ||
    CONFIG_STEMS.includes(stem) ||
    /^\.eslintrc/.test(b) ||
    /^eslint\.config\./.test(b) ||
    /^\.prettierrc/.test(b) ||
    /^prettier\.config\./.test(b) ||
    /^\.babelrc/.test(b) ||
    b === '.env' ||
    b.startsWith('.env.') ||
    b === 'docker-compose.yml' ||
    b.startsWith('docker-compose.') ||
    hasSegment(path, '.storybook')
  );
};

const isTest = (path: string): boolean => {
  const b = base(path);
  return (
    /\.(test|spec|stories)\.[^.]+$/.test(b) ||
    hasSegment(path, '__tests__') ||
    hasSegment(path, '__mocks__') ||
    hasSegment(path, '__snapshots__') ||
    hasSegment(path, 'e2e') ||
    hasSegment(path, 'fixtures') ||
    b.endsWith('.snap')
  );
};

const isDocs = (path: string): boolean => {
  const b = base(path);
  return (
    /\.mdx?$/.test(b) ||
    hasSegment(path, 'docs') ||
    /^(README|CHANGELOG|CONTRIBUTING)(\.|$)/.test(b)
  );
};

/** The ordered rule array. `code` (catch-all) is appended last and always matches. */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  { id: 'dependencies', label: 'Dependencies', match: isManifest },
  { id: 'harness', label: 'Harness', match: isHarness },
  { id: 'ci', label: 'CI', match: isCi },
  { id: 'config', label: 'Config', match: isConfig },
  { id: 'tests', label: 'Tests', match: isTest },
  { id: 'docs', label: 'Docs', match: isDocs },
  { id: 'code', label: 'Code', match: () => true },
];
