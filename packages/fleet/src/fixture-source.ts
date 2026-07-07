/**
 * A {@link FleetSource} backed entirely by baked data (`./fixtures/`) — the
 * zero-config default, so the cockpit renders a live-looking fleet with no token
 * and the surfaces test headlessly. Rich-tier reads return `null` for the
 * baseline-only repo, keeping "unknown" distinct from "none" (source.ts contract).
 */

import {
  FIXTURE_CHECKS,
  FIXTURE_COMMITS,
  FIXTURE_PULLS,
  FIXTURE_REPOS,
} from './fixtures/github.js';
import { FIXTURE_HOOK_EVENTS, FIXTURE_SESSIONS } from './fixtures/ledger.js';
import type { CheckRecord, CommitRecord, PullRecord } from './model/github.js';
import type { FleetRepo } from './model/repo.js';
import { hasRichTier } from './model/repo.js';
import type { HookEventRecord, SessionRecord } from './model/session.js';
import type { FleetSource } from './source.js';

const RICH_SLUGS = new Set(FIXTURE_REPOS.filter(hasRichTier).map((repo) => repo.slug));

function baseline<T>(repo: string, data: Readonly<Record<string, readonly T[]>>): T[] {
  return [...(data[repo] ?? [])];
}

/** Rich-tier read: `null` for a repo without the tier, an array otherwise. */
function rich<T>(repo: string, data: Readonly<Record<string, readonly T[]>>): T[] | null {
  if (!RICH_SLUGS.has(repo)) return null;
  return [...(data[repo] ?? [])];
}

export class FixtureFleetSource implements FleetSource {
  readonly label = 'demo fixture';
  readonly isFixture = true;

  listRepos(): Promise<FleetRepo[]> {
    return Promise.resolve([...FIXTURE_REPOS]);
  }

  listCommits(repo: string): Promise<CommitRecord[]> {
    return Promise.resolve(baseline(repo, FIXTURE_COMMITS));
  }

  listPulls(repo: string): Promise<PullRecord[]> {
    return Promise.resolve(baseline(repo, FIXTURE_PULLS));
  }

  listChecks(repo: string): Promise<CheckRecord[]> {
    return Promise.resolve(baseline(repo, FIXTURE_CHECKS));
  }

  listSessions(repo: string): Promise<SessionRecord[] | null> {
    return Promise.resolve(rich(repo, FIXTURE_SESSIONS));
  }

  listHookEvents(repo: string): Promise<HookEventRecord[] | null> {
    return Promise.resolve(rich(repo, FIXTURE_HOOK_EVENTS));
  }
}
