import { describe, expect, it } from 'vitest';
import { FixtureFleetSource } from './fixture-source.js';
import { hasRichTier } from './model/repo.js';

const setup = () => new FixtureFleetSource();

// Keys that would encode a *person*. The constitution's hard line (principle 1)
// is that no record aggregates by one — this is the behavioural backstop.
const PERSON_KEYS = ['login', 'email', 'user', 'username', 'author', 'name', 'host'];

describe('FixtureFleetSource', () => {
  it('advertises itself as fixture data', () => {
    const source = setup();
    expect(source.isFixture).toBe(true);
    expect(source.label).toBe('demo fixture');
  });

  it('lists multiple repos with declared tiers', async () => {
    const repos = await setup().listRepos();
    expect(repos.length).toBeGreaterThan(1);
    expect(repos.every((r) => r.tiers.includes('baseline'))).toBe(true);
    expect(repos.some(hasRichTier)).toBe(true);
    expect(repos.some((r) => !hasRichTier(r))).toBe(true);
  });

  it('serves baseline data for every repo', async () => {
    const source = setup();
    for (const repo of await source.listRepos()) {
      expect((await source.listCommits(repo.slug)).length).toBeGreaterThan(0);
      expect((await source.listPulls(repo.slug)).length).toBeGreaterThan(0);
    }
  });

  it('returns rich-tier arrays only for instrumented repos', async () => {
    const source = setup();
    for (const repo of await source.listRepos()) {
      const sessions = await source.listSessions(repo.slug);
      if (hasRichTier(repo)) {
        expect(Array.isArray(sessions)).toBe(true);
      } else {
        expect(sessions).toBeNull();
      }
    }
  });

  it('distinguishes "unknown" (null) from "none" ([]) for the rich tier', async () => {
    const source = setup();
    // A baseline-only repo reads null; an instrumented repo reads a (non-null) array.
    const repos = await source.listRepos();
    const baselineOnly = repos.find((r) => !hasRichTier(r));
    const instrumented = repos.find(hasRichTier);
    expect(baselineOnly && (await source.listHookEvents(baselineOnly.slug))).toBeNull();
    expect(instrumented && Array.isArray(await source.listHookEvents(instrumented.slug))).toBe(
      true,
    );
  });

  it('carries an agent identity and no person key on sessions', async () => {
    const source = setup();
    for (const repo of await source.listRepos()) {
      for (const session of (await source.listSessions(repo.slug)) ?? []) {
        expect(session.agent).toBeTruthy();
        for (const key of Object.keys(session)) {
          expect(PERSON_KEYS).not.toContain(key.toLowerCase());
        }
      }
    }
  });
});
