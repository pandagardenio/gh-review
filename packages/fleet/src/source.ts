/**
 * The Control Room's data boundary — the fleet analogue of the engine's
 * `TokenStore`: one interface, swappable backends. Surfaces (CLI, web) read a
 * `FleetSource`; they never talk to GitHub or a ledger directly. `FixtureFleetSource`
 * serves baked data so surfaces run with zero config; `GitHubFleetSource` (BL-025)
 * reads the baseline tier live, and a composed source (BL-027) adds the rich tier.
 *
 * Tier discipline (CONTROL-ROOM-CONSTITUTION.md principle 2 — tiered truth):
 * baseline methods always return an array. Rich-tier methods return `null` for a
 * repo without a ledger — `null` means "unknown / not instrumented", kept distinct
 * from `[]` ("instrumented, but none in the window"). Downstream never blends the two.
 */

import type { CheckRecord, CommitRecord, PullRecord } from './model/github.js';
import type { FleetRepo } from './model/repo.js';
import type { HookEventRecord, SessionRecord } from './model/session.js';

export interface FleetSource {
  /** Human label for the active source, e.g. `demo fixture` or `12 repos`. */
  readonly label: string;
  /** True for baked data, so a surface can show a "demo" banner. */
  readonly isFixture: boolean;

  listRepos(): Promise<FleetRepo[]>;

  // Baseline tier — available for every repo.
  listCommits(repo: string): Promise<CommitRecord[]>;
  listPulls(repo: string): Promise<PullRecord[]>;
  listChecks(repo: string): Promise<CheckRecord[]>;

  // Rich tier — null when the repo has no ledger (not instrumented).
  listSessions(repo: string): Promise<SessionRecord[] | null>;
  listHookEvents(repo: string): Promise<HookEventRecord[] | null>;
}
