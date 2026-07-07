/**
 * Test-only helpers for the web cockpit. A small, fully-typed {@link FleetSource}
 * stub so tests can override just the methods they exercise without an `as any`
 * cast (which Sonar flags) — the defaults satisfy the tier contract: baseline
 * reads return `[]`, rich reads return `null` (not instrumented).
 */

import type { FleetSource } from '@triage/fleet';

/** A {@link FleetSource} whose methods can be selectively overridden per test. */
export function stubFleetSource(over: Partial<FleetSource> = {}): FleetSource {
  return {
    label: 'stub',
    isFixture: false,
    listRepos: () => Promise.resolve([]),
    listCommits: () => Promise.resolve([]),
    listPulls: () => Promise.resolve([]),
    listChecks: () => Promise.resolve([]),
    listSessions: () => Promise.resolve(null),
    listHookEvents: () => Promise.resolve(null),
    ...over,
  };
}
