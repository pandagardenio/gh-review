import { FixtureFleetSource, windowEndingAt } from '@triage/fleet';
import { describe, expect, it, vi } from 'vitest';
import { mountFleet } from './fleet.js';

const NOW_ISO = '2026-06-26T12:20:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const WINDOW = windowEndingAt(NOW_ISO, 30);

function demoContext() {
  return { source: new FixtureFleetSource(), window: WINDOW, isDemo: true };
}

describe('mountFleet', () => {
  it('renders the health grid with rich and baseline repos, honestly labelled', async () => {
    const root = document.createElement('div');
    await mountFleet(root, demoContext(), NOW_MS, () => {});

    // demo banner + a repo grid.
    expect(root.querySelector('.cr-header')?.textContent).toContain('demo data');
    const repos = [...root.querySelectorAll('.cr-fleet__repo')].map((b) => b.textContent);
    expect(repos).toContain('acme/widgets'); // rich tier
    expect(repos).toContain('acme/docs-site'); // baseline tier

    // A baseline-tier repo shows "—" active sessions (no ledger), distinct from 0.
    const docsRow = [...root.querySelectorAll('.cr-fleet__row')].find(
      (r) => r.querySelector('.cr-fleet__repo')?.textContent === 'acme/docs-site',
    );
    expect(docsRow?.textContent).toContain('—');
  });

  it('drills into a repo when its name is clicked', async () => {
    const root = document.createElement('div');
    const onRepo = vi.fn();
    await mountFleet(root, demoContext(), NOW_MS, onRepo);

    const widgets = [...root.querySelectorAll('button.cr-fleet__repo')].find(
      (b) => b.textContent === 'acme/widgets',
    );
    (widgets as HTMLButtonElement).click();
    expect(onRepo).toHaveBeenCalledWith('acme/widgets');
  });

  it('shows a freshness line with the fresh-repo and session counts', async () => {
    const root = document.createElement('div');
    await mountFleet(root, demoContext(), NOW_MS, () => {});
    const foot = root.querySelector('.cr-fleet__foot')?.textContent ?? '';
    expect(foot).toMatch(/repos fresh/);
    expect(foot).toMatch(/sessions/);
  });
});
