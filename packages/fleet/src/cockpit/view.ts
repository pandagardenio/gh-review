/**
 * Cockpit view-models (BL-028): pure async builders over a {@link FleetSource} that
 * produce the exact data the surfaces render — the CLI's `--json` output *is* these
 * structures, and the web cockpit consumes the same. All roll-up choices live here,
 * in the core, so the two cockpits can never drift. No ANSI, no DOM.
 *
 * Every builder is per-repo resilient: one repo's load failure becomes that repo's
 * error row/entry, never a thrown fleet-wide view (CONTROL-ROOM-CONSTITUTION.md §2).
 */

import {
  type HarnessGrade,
  type HarnessHealth,
  type HarnessStatus,
  harnessHealth,
} from '../harness/harness-health.js';
import { countActivity, type SessionActivity, sessionActivity } from '../ledger/activity.js';
import type { CheckRecord, CommitRecord, PullRecord } from '../model/github.js';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import { ciHealth } from '../provenance/ci-health.js';
import { type ProvenanceWindow, provenanceShare } from '../provenance/share.js';
import { type ProvenanceTrendPoint, provenanceTrend } from '../provenance/trend.js';
import type { FleetSource } from '../source.js';

interface RepoData {
  readonly commits: CommitRecord[];
  readonly pulls: PullRecord[];
  readonly checks: CheckRecord[];
  readonly sessions: SessionRecord[] | null;
  readonly hookEvents: HookEventRecord[] | null;
}

async function loadRepoData(source: FleetSource, repo: string): Promise<RepoData> {
  const [commits, pulls, checks, sessions, hookEvents] = await Promise.all([
    source.listCommits(repo),
    source.listPulls(repo),
    source.listChecks(repo),
    source.listSessions(repo),
    source.listHookEvents(repo),
  ]);
  return { commits, pulls, checks, sessions, hookEvents };
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'load failed';

// --- fleet grid ---

export interface FleetRow {
  readonly repo: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly score: number | null;
  readonly grade: HarnessGrade | null;
  readonly status: HarnessStatus;
  readonly agentPrShare: number | null;
  readonly agentCiFailureRate: number | null;
  /** null = baseline tier (no ledger), distinct from 0 active. */
  readonly activeSessions: number | null;
}

export interface FleetView {
  readonly rows: readonly FleetRow[];
  readonly refreshed: number;
  readonly total: number;
  readonly asOfMs: number;
}

/** Order worst-actionable first: errors, then lowest score, then unknown last. */
function worstFirst(a: FleetRow, b: FleetRow): number {
  if (a.ok !== b.ok) return a.ok ? 1 : -1;
  if (a.score === null && b.score === null) return a.repo.localeCompare(b.repo);
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return a.score - b.score;
}

export async function buildFleetView(
  source: FleetSource,
  window: ProvenanceWindow,
  nowMs: number,
): Promise<FleetView> {
  const repos = await source.listRepos();
  const rows: FleetRow[] = [];
  let refreshed = 0;

  for (const repo of repos) {
    try {
      const data = await loadRepoData(source, repo.slug);
      const health = harnessHealth(
        {
          pulls: data.pulls,
          checks: data.checks,
          sessions: data.sessions,
          hookEvents: data.hookEvents,
        },
        window,
      );
      rows.push({
        repo: repo.slug,
        ok: true,
        score: health.score,
        grade: health.grade,
        status: health.status,
        agentPrShare: provenanceShare(data.commits, data.pulls, window).prShare,
        agentCiFailureRate: ciHealth(data.pulls, data.checks, window).agent.failureRate,
        activeSessions: data.sessions === null ? null : countActivity(data.sessions, nowMs).active,
      });
      refreshed += 1;
    } catch (error) {
      rows.push({
        repo: repo.slug,
        ok: false,
        error: errorMessage(error),
        score: null,
        grade: null,
        status: 'unknown',
        agentPrShare: null,
        agentCiFailureRate: null,
        activeSessions: null,
      });
    }
  }

  rows.sort(worstFirst);
  return { rows, refreshed, total: repos.length, asOfMs: nowMs };
}

// --- live sessions ---

export interface SessionRow {
  readonly repo: string;
  readonly agent: string;
  readonly activity: Exclude<SessionActivity, 'ended'>;
  readonly ageSeconds: number;
  readonly pr: number | null;
  readonly branch: string | null;
  readonly id: string;
}

export interface SessionsView {
  readonly rows: readonly SessionRow[];
  readonly asOfMs: number;
}

/** Active + stale sessions across the fleet (ended excluded). Active first, oldest first. */
export async function buildSessionsView(source: FleetSource, nowMs: number): Promise<SessionsView> {
  const repos = await source.listRepos();
  const rows: SessionRow[] = [];

  for (const repo of repos) {
    let sessions: SessionRecord[] | null;
    try {
      sessions = await source.listSessions(repo.slug);
    } catch {
      continue; // a repo without readable sessions simply contributes none
    }
    if (sessions === null) continue;
    for (const session of sessions) {
      const activity = sessionActivity(session, nowMs);
      if (activity === 'ended') continue;
      rows.push({
        repo: repo.slug,
        agent: session.agent,
        activity,
        ageSeconds: Math.max(0, (nowMs - Date.parse(session.startedAt)) / 1000),
        pr: session.pr,
        branch: session.branch,
        id: session.id,
      });
    }
  }

  rows.sort((a, b) =>
    a.activity === b.activity ? b.ageSeconds - a.ageSeconds : a.activity === 'active' ? -1 : 1,
  );
  return { rows, asOfMs: nowMs };
}

// --- one repo drill-down ---

export interface RepoSession {
  readonly id: string;
  readonly agent: string;
  readonly activity: SessionActivity;
  readonly status: SessionRecord['status'];
  readonly pr: number | null;
  readonly branch: string | null;
}

export interface RepoReviewPull {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly reviewStates: readonly PullRecord['reviewStates'][number][];
}

export interface RepoView {
  readonly repo: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly health: HarnessHealth;
  readonly provenanceTrend: readonly ProvenanceTrendPoint[];
  readonly agentCiFailureRate: number | null;
  readonly failuresByCheck: ReturnType<typeof ciHealth>['failuresByCheck'];
  readonly sessions: readonly RepoSession[];
  readonly reviewPulls: readonly RepoReviewPull[];
  readonly asOfMs: number;
}

const UNKNOWN_HEALTH: HarnessHealth = {
  score: null,
  grade: null,
  status: 'unknown',
  components: [],
  missing: [],
};

export async function buildRepoView(
  source: FleetSource,
  repo: string,
  window: ProvenanceWindow,
  nowMs: number,
): Promise<RepoView> {
  try {
    const data = await loadRepoData(source, repo);
    const ci = ciHealth(data.pulls, data.checks, window);
    return {
      repo,
      ok: true,
      health: harnessHealth(
        {
          pulls: data.pulls,
          checks: data.checks,
          sessions: data.sessions,
          hookEvents: data.hookEvents,
        },
        window,
      ),
      provenanceTrend: provenanceTrend(data.commits, data.pulls, window, 'week'),
      agentCiFailureRate: ci.agent.failureRate,
      failuresByCheck: ci.failuresByCheck,
      sessions: (data.sessions ?? []).map((session) => ({
        id: session.id,
        agent: session.agent,
        activity: sessionActivity(session, nowMs),
        status: session.status,
        pr: session.pr,
        branch: session.branch,
      })),
      reviewPulls: data.pulls
        .filter((pull) => pull.state === 'open')
        .map((pull) => ({
          number: pull.number,
          title: pull.title,
          url: pull.url,
          reviewStates: [...pull.reviewStates],
        })),
      asOfMs: nowMs,
    };
  } catch (error) {
    return {
      repo,
      ok: false,
      error: errorMessage(error),
      health: UNKNOWN_HEALTH,
      provenanceTrend: [],
      agentCiFailureRate: null,
      failuresByCheck: [],
      sessions: [],
      reviewPulls: [],
      asOfMs: nowMs,
    };
  }
}
