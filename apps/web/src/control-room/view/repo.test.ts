import { FixtureFleetSource, windowEndingAt } from '@triage/fleet';
import { describe, expect, it, vi } from 'vitest';
import { mountRepo } from './repo.js';

const NOW_ISO = '2026-06-26T12:20:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const WINDOW = windowEndingAt(NOW_ISO, 30);

function demoContext() {
  return { source: new FixtureFleetSource(), window: WINDOW, isDemo: true };
}

const noop = { factory: () => {}, back: () => {} };

describe('mountRepo', () => {
  it('renders a rich-tier repo with score components and a Factory affordance', async () => {
    const root = document.createElement('div');
    await mountRepo(root, demoContext(), 'acme/widgets', NOW_MS, noop);

    expect(root.textContent).toContain('acme/widgets');
    expect(root.textContent).toContain('Score components');
    // rich tier → the deeper factory level is offered.
    expect(root.querySelector('.cr-repo__factory')).not.toBeNull();
  });

  it('offers NO factory affordance for a baseline-tier repo (no dead-end)', async () => {
    const root = document.createElement('div');
    await mountRepo(root, demoContext(), 'acme/docs-site', NOW_MS, noop);

    expect(root.textContent).toContain('acme/docs-site');
    expect(root.querySelector('.cr-repo__factory')).toBeNull();
    // baseline tier → sessions are absent, honestly stated (never a fabricated 0).
    expect(root.textContent).toContain('baseline tier or none');
  });

  it('drills into the factory when the Factory affordance is clicked', async () => {
    const root = document.createElement('div');
    const factory = vi.fn();
    await mountRepo(root, demoContext(), 'acme/widgets', NOW_MS, { factory, back: () => {} });

    (root.querySelector('.cr-repo__factory') as HTMLButtonElement).click();
    expect(factory).toHaveBeenCalledOnce();
  });

  it('returns to the fleet when the back header is clicked', async () => {
    const root = document.createElement('div');
    const back = vi.fn();
    await mountRepo(root, demoContext(), 'acme/widgets', NOW_MS, { factory: () => {}, back });

    (root.querySelector('.cr-repo__back') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalledOnce();
  });

  it('renders an error state (no factory link) when the repo cannot be read', async () => {
    const root = document.createElement('div');
    const failing = {
      source: {
        listRepos: () => Promise.resolve([]),
        listCommits: () => Promise.reject(new Error('rate limited')),
        listPulls: () => Promise.reject(new Error('rate limited')),
        listChecks: () => Promise.reject(new Error('rate limited')),
        listSessions: () => Promise.reject(new Error('rate limited')),
        listHookEvents: () => Promise.reject(new Error('rate limited')),
        // biome-ignore lint/suspicious/noExplicitAny: minimal stub for the error path
      } as any,
      window: WINDOW,
      isDemo: false,
    };
    await mountRepo(root, failing, 'acme/broken', NOW_MS, noop);
    expect(root.querySelector('.cr-app--error')?.textContent).toContain('acme/broken');
    expect(root.querySelector('.cr-repo__factory')).toBeNull();
  });
});
