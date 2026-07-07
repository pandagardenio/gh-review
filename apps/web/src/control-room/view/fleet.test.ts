import { FixtureFleetSource, type FleetRow, type FleetView, windowEndingAt } from '@triage/fleet';
import { describe, expect, it, vi } from 'vitest';
import { stubFleetSource } from '../test-support.js';
import { buildFleetPage, mountFleet } from './fleet.js';

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

  it('never paints a partial/unknown-tier repo a confident green', async () => {
    const root = document.createElement('div');
    await mountFleet(root, demoContext(), NOW_MS, () => {});
    for (const row of root.querySelectorAll('.cr-fleet__row')) {
      const health = row.querySelector('.cr-fleet__health');
      const label = health?.textContent ?? '';
      if (label.includes('partial') || label.includes('unknown')) {
        expect(health?.querySelector('.cr-badge--ok')).toBeNull();
      }
    }
  });

  it('renders an error state when the fleet cannot be read', async () => {
    const root = document.createElement('div');
    const failing = {
      source: stubFleetSource({ listRepos: () => Promise.reject(new Error('rate limited')) }),
      window: WINDOW,
      isDemo: false,
    };
    await mountFleet(root, failing, NOW_MS, () => {});
    expect(root.querySelector('.cr-app--error')?.textContent).toContain('rate limited');
  });

  it('shows an empty-grid hint when no repos are configured', async () => {
    const root = document.createElement('div');
    const empty = {
      source: stubFleetSource(),
      window: WINDOW,
      isDemo: false,
    };
    await mountFleet(root, empty, NOW_MS, () => {});
    expect(root.querySelector('.cr-empty')?.textContent).toContain('No repos configured');
  });

  it('renders a per-repo error row without dropping the fleet', () => {
    const errorRow: FleetRow = {
      repo: 'acme/broken',
      ok: false,
      error: 'bad token',
      score: null,
      grade: null,
      status: 'unknown',
      agentPrShare: null,
      agentCiFailureRate: null,
      activeSessions: null,
    };
    const view: FleetView = { rows: [errorRow], refreshed: 0, total: 1, asOfMs: NOW_MS };
    const node = buildFleetPage(view, { rows: [], asOfMs: NOW_MS }, () => {});
    const row = node.querySelector('.cr-fleet__row--error');
    expect(row?.textContent).toContain('acme/broken');
    expect(row?.textContent).toContain('bad token');
  });
});
