import { FixtureFleetSource, windowEndingAt } from '@triage/fleet';
import { describe, expect, it } from 'vitest';
import { COCKPIT_COMMANDS, runView, type ViewOptions } from './run.js';

const NOW_ISO = '2026-06-26T12:20:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const WINDOW = windowEndingAt(NOW_ISO, 30);

const opts = (over: Partial<ViewOptions> = {}): ViewOptions => ({
  json: false,
  color: false,
  nowMs: NOW_MS,
  ...over,
});

describe('COCKPIT_COMMANDS', () => {
  it('lists the three read-only cockpit commands', () => {
    expect([...COCKPIT_COMMANDS]).toEqual(['fleet', 'sessions', 'repo']);
  });
});

describe('runView --json', () => {
  it('emits stable JSON for the fleet grid', async () => {
    const source = new FixtureFleetSource();
    const out = await runView('fleet', source, WINDOW, opts({ json: true }));
    const view = JSON.parse(out) as { rows: Array<{ repo: string }>; total: number };
    expect(view.total).toBeGreaterThan(0);
    expect(view.rows.map((r) => r.repo).sort()).toContain('acme/widgets');
  });

  it('emits stable JSON for sessions', async () => {
    const source = new FixtureFleetSource();
    const out = await runView('sessions', source, WINDOW, opts({ json: true }));
    const view = JSON.parse(out) as { rows: Array<{ activity: string }> };
    expect(view.rows.every((r) => r.activity === 'active' || r.activity === 'stale')).toBe(true);
  });

  it('emits stable JSON for one repo drill-down', async () => {
    const source = new FixtureFleetSource();
    const out = await runView('repo', source, WINDOW, opts({ json: true, repo: 'acme/widgets' }));
    const view = JSON.parse(out) as { repo: string; ok: boolean };
    expect(view.repo).toBe('acme/widgets');
    expect(view.ok).toBe(true);
  });
});

describe('runView rendered', () => {
  it('renders the fleet grid as a plain-text table with no ANSI when color is off', async () => {
    const source = new FixtureFleetSource();
    const out = await runView('fleet', source, WINDOW, opts());
    expect(out).toContain('REPO');
    expect(out).toContain('acme/widgets');
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ESC is absent
    expect(out).not.toMatch(/\[/);
  });

  it('renders a repo drill-down heading', async () => {
    const source = new FixtureFleetSource();
    const out = await runView('repo', source, WINDOW, opts({ repo: 'acme/widgets' }));
    expect(out).toContain('acme/widgets');
    expect(out).toContain('health');
  });
});
