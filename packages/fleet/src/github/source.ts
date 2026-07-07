/**
 * `GitHubFleetSource` (BL-025): the baseline tier read live from the GitHub REST
 * API for an explicit list of repos. Implements the {@link FleetSource} contract;
 * rich-tier reads return `null` (that is BL-027's job). Environment-agnostic —
 * global `fetch`, no DOM — so the same source powers the CLI and the web app.
 *
 * Resilience (CONTROL-ROOM-CONSTITUTION.md §2): the per-repo methods throw a
 * classified {@link GitHubApiError}, but {@link GitHubFleetSource.loadFleet} catches
 * per repo so one bad repo (bad token / no access / rate-limited) never poisons the
 * fleet — it surfaces as that repo's error while the others load, with a
 * "N/M refreshed" count instead of silent staleness.
 */

import type { CheckRecord, CommitRecord, PullRecord } from '../model/github.js';
import type { FleetRepo } from '../model/repo.js';
import { repoSlug } from '../model/repo.js';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import { inWindow, type ProvenanceWindow } from '../provenance/share.js';
import type { FleetSource } from '../source.js';
import type { GitHubClientOptions, GitHubErrorKind } from './client.js';
import { GitHubApiError, GitHubClient } from './client.js';
import {
  mapCheckRun,
  mapCommit,
  mapPull,
  mapReviewStates,
  type RawCheckRun,
  type RawCommit,
  type RawPull,
  type RawReview,
} from './mappers.js';

export interface GitHubFleetSourceOptions extends GitHubClientOptions {
  /** `owner/repo` slugs to read. v1 takes an explicit list (no org discovery). */
  readonly repos: readonly string[];
  /** The metrics window; only this slice of history is fetched. */
  readonly window: ProvenanceWindow;
}

/** One repo's baseline data, or the error that stopped it loading. */
export type RepoLoad =
  | {
      readonly repo: string;
      readonly ok: true;
      readonly commits: CommitRecord[];
      readonly pulls: PullRecord[];
      readonly checks: CheckRecord[];
    }
  | {
      readonly repo: string;
      readonly ok: false;
      readonly kind: GitHubErrorKind;
      readonly message: string;
    };

export interface FleetRefresh {
  readonly loads: readonly RepoLoad[];
  /** Repos that loaded without error. */
  readonly refreshed: number;
  readonly total: number;
}

export class GitHubFleetSource implements FleetSource {
  readonly isFixture = false;
  readonly #client: GitHubClient;
  readonly #repos: readonly string[];
  readonly #window: ProvenanceWindow;

  constructor(options: GitHubFleetSourceOptions) {
    this.#client = new GitHubClient(options);
    this.#repos = options.repos;
    this.#window = options.window;
  }

  get label(): string {
    return `${this.#repos.length} repos`;
  }

  listRepos(): Promise<FleetRepo[]> {
    return Promise.resolve(
      this.#repos.map((slug) => {
        const [owner = '', name = ''] = slug.split('/');
        return { owner, name, slug: repoSlug(owner, name), tiers: ['baseline'] as const };
      }),
    );
  }

  async listCommits(repo: string): Promise<CommitRecord[]> {
    const raw = await this.#client.getPaged<RawCommit>(
      `/repos/${repo}/commits?since=${this.#window.since}&until=${this.#window.until}&per_page=100`,
    );
    return raw.map((commit) => mapCommit(repo, commit));
  }

  async listPulls(repo: string): Promise<PullRecord[]> {
    const since = Date.parse(this.#window.since);
    // Sorted created-desc, so once a page's oldest PR predates the window, every
    // later page does too — stop, rather than pull the repo's whole PR history.
    const raw = await this.#client.getPaged<RawPull>(
      `/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100`,
      {
        stopWhen: (page) => {
          const oldest = page.at(-1);
          return oldest ? Date.parse(oldest.created_at) < since : false;
        },
      },
    );
    const inWindowPulls = raw.filter((pull) => inWindow(pull.created_at, this.#window));
    const out: PullRecord[] = [];
    for (const pull of inWindowPulls) {
      const reviews = await this.#client.getPaged<RawReview>(
        `/repos/${repo}/pulls/${pull.number}/reviews?per_page=100`,
      );
      out.push(mapPull(repo, pull, mapReviewStates(reviews)));
    }
    return out;
  }

  async listChecks(repo: string): Promise<CheckRecord[]> {
    return this.#checksForPulls(repo, await this.listPulls(repo));
  }

  // Rich tier — not this source's job (BL-027). Null = unknown / not instrumented.
  listSessions(): Promise<SessionRecord[] | null> {
    return Promise.resolve(null);
  }

  listHookEvents(): Promise<HookEventRecord[] | null> {
    return Promise.resolve(null);
  }

  /**
   * Load every repo's baseline, catching per repo so one failure never poisons the
   * fleet. `pulls` is computed once and reused for `checks` to avoid a duplicate fetch.
   */
  async loadFleet(): Promise<FleetRefresh> {
    const loads: RepoLoad[] = [];
    for (const repo of this.#repos) {
      loads.push(await this.#loadRepo(repo));
    }
    return { loads, refreshed: loads.filter((load) => load.ok).length, total: loads.length };
  }

  async #loadRepo(repo: string): Promise<RepoLoad> {
    try {
      const [commits, pulls] = await Promise.all([this.listCommits(repo), this.listPulls(repo)]);
      const checks = await this.#checksForPulls(repo, pulls);
      return { repo, ok: true, commits, pulls, checks };
    } catch (error) {
      const apiError =
        error instanceof GitHubApiError
          ? error
          : new GitHubApiError('unknown', error instanceof Error ? error.message : 'load failed');
      return { repo, ok: false, kind: apiError.kind, message: apiError.message };
    }
  }

  async #checksForPulls(repo: string, pulls: readonly PullRecord[]): Promise<CheckRecord[]> {
    const out: CheckRecord[] = [];
    const seen = new Set<string>();
    for (const pull of pulls) {
      if (seen.has(pull.headSha)) continue;
      seen.add(pull.headSha);
      const payload = await this.#client.getOne<{ check_runs?: RawCheckRun[] }>(
        `/repos/${repo}/commits/${pull.headSha}/check-runs`,
      );
      for (const run of payload.check_runs ?? []) out.push(mapCheckRun(repo, pull.headSha, run));
    }
    return out;
  }
}
