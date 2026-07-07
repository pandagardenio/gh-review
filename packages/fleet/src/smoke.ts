import { FixtureFleetSource } from './fixture-source.js';

/** Bumped by hand; lets surfaces confirm which fleet build they loaded. */
export const FLEET_VERSION = '0.0.0';

/**
 * Trivial proof-of-life used by the surfaces (and the smoke test) to confirm the
 * fleet core bundles and runs end to end — reads the fixture source once, without
 * touching the network or any DOM/extension API.
 */
export async function fleetSmoke(): Promise<string> {
  const source = new FixtureFleetSource();
  const repos = await source.listRepos();
  return `@triage/fleet ${FLEET_VERSION} ok (repos=${repos.length})`;
}
