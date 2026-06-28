import type { DiffFile, PullRequestDiff } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { createTriagePanel } from './panel.js';

const file = (path: string, over: Partial<DiffFile> = {}): DiffFile => ({
  path,
  change: 'modified',
  additions: 2,
  deletions: 1,
  isBinary: false,
  patch: '@@',
  ...over,
});

const PKG_PATCH = ['@@ -1,3 +1,3 @@', '   "dependencies": {', '+    "zod": "^3.22.0"', '   }'].join(
  '\n',
);

const diff = (files: DiffFile[]): PullRequestDiff => ({
  owner: 'octo',
  repo: 'repo',
  number: 1,
  headSha: 'deadbeef',
  files,
});

const setup = () =>
  diff([
    file('package.json', { patch: PKG_PATCH }),
    file('README.md'),
    file('src/app.test.ts'),
    file('src/app.ts'),
  ]);

describe('createTriagePanel', () => {
  it('renders a section per category in review order', async () => {
    const panel = await createTriagePanel(setup());
    const labels = [...panel.querySelectorAll('.triage-section__label')].map((n) => n.textContent);
    expect(labels).toEqual(['Dependencies', 'Tests', 'Docs', 'Code']);
  });

  it('collapses the Code section by default and leaves others open', async () => {
    const panel = await createTriagePanel(setup());
    const code = panel.querySelector('.triage-section--code .triage-section__files') as HTMLElement;
    const docs = panel.querySelector('.triage-section--docs .triage-section__files') as HTMLElement;
    expect(code.hidden).toBe(true);
    expect(docs.hidden).toBe(false);
  });

  it('keeps every file reachable (none dropped, none hidden permanently)', async () => {
    const panel = await createTriagePanel(setup());
    // DOM order follows the categorized section order, not input order.
    const links = [...panel.querySelectorAll('.triage-file__link')].map((n) => n.textContent);
    expect(links).toEqual(['package.json', 'src/app.test.ts', 'README.md', 'src/app.ts']);
  });

  it('toggling a section header flips its collapsed state', async () => {
    const panel = await createTriagePanel(setup());
    const toggle = panel.querySelector(
      '.triage-section--code .triage-section__toggle',
    ) as HTMLButtonElement;
    const list = panel.querySelector('.triage-section--code .triage-section__files') as HTMLElement;
    expect(list.hidden).toBe(true);
    toggle.click();
    expect(list.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(list.hidden).toBe(true);
  });

  it('links each file to its native #diff- anchor', async () => {
    const panel = await createTriagePanel(setup());
    const href = panel.querySelector('.triage-file__link')?.getAttribute('href');
    expect(href).toMatch(/^#diff-[0-9a-f]{64}$/);
  });

  it('inlines dependency rows inside the Dependencies section', async () => {
    const panel = await createTriagePanel(setup());
    const dep = panel.querySelector('.triage-section--dependencies .triage-dep__name');
    expect(dep?.textContent).toBe('zod');
  });

  it('shows total file count and per-section churn', async () => {
    const panel = await createTriagePanel(setup());
    expect(panel.querySelector('.triage-panel__count')?.textContent).toBe('4 files');
    const churn = panel.querySelector('.triage-section--docs .triage-section__churn');
    expect(churn?.textContent).toBe('+2 −1');
  });

  it('builds CSP-safe: a path with markup stays text, not parsed HTML', async () => {
    const panel = await createTriagePanel(diff([file('src/<img src=x>.ts')]));
    expect(panel.querySelector('img')).toBeNull();
    expect(panel.querySelector('.triage-file__link')?.textContent).toBe('src/<img src=x>.ts');
  });

  it('honours a custom title', async () => {
    const panel = await createTriagePanel(setup(), { title: 'Review' });
    expect(panel.querySelector('.triage-panel__title')?.textContent).toBe('Review');
  });
});
