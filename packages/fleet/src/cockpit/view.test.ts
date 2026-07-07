import { describe, expect, it } from 'vitest';
import { FixtureFleetSource } from '../fixture-source.js';
import type { FleetSource } from '../source.js';
import { buildFleetView, buildRepoView, buildSessionsView } from './view.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' };
// Near the fixture heartbeats: sess-w-2 beat 12:14 (fresh), sess-w-3 beat a day earlier (stale).
const NOW = Date.parse('2026-06-26T12:20:00.000Z');

describe('buildFleetView', () => {
  it('produces one row per repo with tier-aware active-session counts', async () => {
    const view = await buildFleetView(new FixtureFleetSource(), WINDOW, NOW);
    expect(view.total).toBe(3);
    expect(view.refreshed).toBe(3);
    const bySlug = new Map(view.rows.map((r) => [r.repo, r]));
    // docs-site is baseline-only → activeSessions null (unknown), not 0.
    expect(bySlug.get('acme/docs-site')?.activeSessions).toBeNull();
    expect(typeof bySlug.get('acme/widgets')?.activeSessions).toBe('number');
  });

  it('emits a stable JSON row shape for scripting', async () => {
    const view = await buildFleetView(new FixtureFleetSource(), WINDOW, NOW);
    expect(Object.keys(view.rows[0] ?? {}).sort()).toEqual([
      'activeSessions',
      'agentCiFailureRate',
      'agentPrShare',
      'grade',
      'ok',
      'repo',
      'score',
      'status',
    ]);
  });

  it('renders an erroring repo as its own error row while the rest load', async () => {
    const base = new FixtureFleetSource();
    const flaky: FleetSource = {
      label: base.label,
      isFixture: base.isFixture,
      listRepos: () => base.listRepos(),
      listCommits: (repo) =>
        repo === 'acme/api' ? Promise.reject(new Error('rate limited')) : base.listCommits(repo),
      listPulls: (repo) => base.listPulls(repo),
      listChecks: (repo) => base.listChecks(repo),
      listSessions: (repo) => base.listSessions(repo),
      listHookEvents: (repo) => base.listHookEvents(repo),
    };
    const view = await buildFleetView(flaky, WINDOW, NOW);
    const api = view.rows.find((r) => r.repo === 'acme/api');
    expect(api?.ok).toBe(false);
    expect(api?.error).toContain('rate limited');
    expect(view.refreshed).toBe(2); // the other two still loaded
    expect(view.rows[0]?.ok).toBe(false); // error rows sort first (worst-actionable)
  });
});

describe('buildSessionsView', () => {
  it('lists active and stale sessions (ended excluded), active first', async () => {
    const view = await buildSessionsView(new FixtureFleetSource(), NOW);
    const byId = new Map(view.rows.map((r) => [r.id, r]));
    expect(byId.get('sess-w-2')?.activity).toBe('active'); // fresh heartbeat
    expect(byId.get('sess-w-3')?.activity).toBe('stale'); // day-old heartbeat
    expect(byId.has('sess-a-1')).toBe(false); // terminal → excluded
    expect(view.rows[0]?.activity).toBe('active'); // active sorts before stale
  });
});

describe('buildRepoView', () => {
  it('assembles the drill-down for one repo', async () => {
    const view = await buildRepoView(new FixtureFleetSource(), 'acme/widgets', WINDOW, NOW);
    expect(view.ok).toBe(true);
    expect(view.health.status).toMatch(/full|partial|unknown/);
    expect(view.provenanceTrend.length).toBeGreaterThan(0);
    expect(view.sessions.some((s) => s.id === 'sess-w-2')).toBe(true);
    expect(view.reviewPulls.every((p) => p.url.startsWith('https://'))).toBe(true);
  });
});
