import {
  FixtureFleetSource,
  type FleetRepo,
  type SessionRecord,
  windowEndingAt,
} from '@triage/fleet';
import { describe, expect, it, vi } from 'vitest';
import { stubFleetSource } from '../test-support.js';
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

  // A live baseline source tags every FleetRepo `baseline` (GitHubFleetSource does),
  // so the factory gate must key off listSessions null-ness, not FleetRepo.tiers.
  function liveLike(sessions: SessionRecord[] | null) {
    const repos: FleetRepo[] = [
      { owner: 'acme', name: 'api', slug: 'acme/api', tiers: ['baseline'] },
    ];
    return {
      source: stubFleetSource({
        listRepos: () => Promise.resolve(repos),
        listSessions: () => Promise.resolve(sessions),
        listHookEvents: () => Promise.resolve(sessions === null ? null : []),
      }),
      window: WINDOW,
      isDemo: false,
    };
  }

  it('offers the factory for a live repo with a readable ledger (tiers say baseline)', async () => {
    const root = document.createElement('div');
    await mountRepo(root, liveLike([]), 'acme/api', NOW_MS, noop);
    expect(root.querySelector('.cr-repo__factory')).not.toBeNull();
  });

  it('withholds the factory for a live repo with no ledger (listSessions null)', async () => {
    const root = document.createElement('div');
    await mountRepo(root, liveLike(null), 'acme/api', NOW_MS, noop);
    expect(root.querySelector('.cr-repo__factory')).toBeNull();
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
      source: stubFleetSource({
        listCommits: () => Promise.reject(new Error('rate limited')),
      }),
      window: WINDOW,
      isDemo: false,
    };
    await mountRepo(root, failing, 'acme/broken', NOW_MS, noop);
    expect(root.querySelector('.cr-app--error')?.textContent).toContain('acme/broken');
    expect(root.querySelector('.cr-repo__factory')).toBeNull();
    // the error state still offers a way back to the fleet — never a dead-end.
    expect(root.querySelector('.cr-repo__back')).not.toBeNull();
  });
});
