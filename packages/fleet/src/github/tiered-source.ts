/**
 * `TieredFleetSource` (BL-027): the single {@link FleetSource} the cockpits consume,
 * composing a **baseline** source (BL-025, GitHub REST) with a **rich** reader
 * (BL-027, the ledger). Baseline reads always resolve; rich reads resolve to `null`
 * for a repo without a ledger — so "unknown / not instrumented" stays distinct from
 * "instrumented, none", and a surface labels a repo's tier straight off `listSessions`.
 */

import type { CheckRecord, CommitRecord, PullRecord } from '../model/github.js';
import type { FleetRepo } from '../model/repo.js';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import type { FleetSource } from '../source.js';
import type { RichReader } from './ledger-source.js';

export class TieredFleetSource implements FleetSource {
  readonly isFixture = false;
  readonly #baseline: FleetSource;
  readonly #rich: RichReader;

  constructor(baseline: FleetSource, rich: RichReader) {
    this.#baseline = baseline;
    this.#rich = rich;
  }

  get label(): string {
    return this.#baseline.label;
  }

  listRepos(): Promise<FleetRepo[]> {
    return this.#baseline.listRepos();
  }

  listCommits(repo: string): Promise<CommitRecord[]> {
    return this.#baseline.listCommits(repo);
  }

  listPulls(repo: string): Promise<PullRecord[]> {
    return this.#baseline.listPulls(repo);
  }

  listChecks(repo: string): Promise<CheckRecord[]> {
    return this.#baseline.listChecks(repo);
  }

  listSessions(repo: string): Promise<SessionRecord[] | null> {
    return this.#rich.listSessions(repo);
  }

  listHookEvents(repo: string): Promise<HookEventRecord[] | null> {
    return this.#rich.listHookEvents(repo);
  }
}
