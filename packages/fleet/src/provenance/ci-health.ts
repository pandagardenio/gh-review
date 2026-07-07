/**
 * CI-health roll-ups (BL-023): how often agent work fails CI, how long it takes
 * to go green, and how many red→green cycles it needed — with an anonymous
 * human-authored baseline so "agents fail 2× baseline" is sayable. Pure functions
 * over the baseline-tier {@link PullRecord}s and {@link CheckRecord}s; we only
 * *read* checks — never re-run, never gate (CONTROL-ROOM-CONSTITUTION.md §5).
 *
 * Simplifications, documented per the backlog: v1 counts every completed check
 * run (branch-protection's required-vs-optional distinction is not modelled); a
 * PR's checks are the runs on any SHA the PR has had as head (see `headShas`), so
 * a force-pushed-away red still counts; and a PR is placed in the window by its
 * creation time, so a long-lived PR whose CI ran inside the window but was opened
 * before it is not counted.
 */

import type { CheckConclusion, CheckRecord, PullRecord } from '../model/github.js';
import type { AgentIdentityConfig } from './agent-identity.js';
import { classifyPull, DEFAULT_AGENT_IDENTITY } from './agent-identity.js';
import type { ProvenanceWindow } from './share.js';
import { inWindow } from './share.js';

/**
 * Below this many classified PRs (with checks) in the window, a group's rates
 * report `null` — no confident numbers from a handful of PRs (tiered truth,
 * CONTROL-ROOM-CONSTITUTION.md §2). Counts are always reported.
 */
export const MIN_PRS_FOR_RATE = 3;

/** Per-group CI stats. The human group is an anonymous aggregate — no per-person field. */
export interface CiHealthStat {
  /** Classified PRs with ≥1 check in the window. */
  readonly prs: number;
  readonly failedPrs: number;
  /**
   * PRs that reached an all-green check suite. `prs - failedPrs - greenPrs` is the
   * inconclusive remainder (only cancelled/pending checks) — surfaced, not folded
   * into "pass", so a repo whose agents never actually go green is visible.
   */
  readonly greenPrs: number;
  /** `failedPrs / prs`, or null below {@link MIN_PRS_FOR_RATE}. */
  readonly failureRate: number | null;
  readonly p50TimeToGreenSeconds: number | null;
  readonly p95TimeToGreenSeconds: number | null;
  readonly totalCycles: number;
  /** Mean red→green cycles per PR, or null below the threshold. */
  readonly avgCycles: number | null;
}

/** Which check names agent PRs trip over, busiest first. */
export interface CheckFailureCluster {
  readonly name: string;
  readonly failures: number;
}

export interface CiHealth {
  readonly agent: CiHealthStat;
  readonly human: CiHealthStat;
  readonly failuresByCheck: readonly CheckFailureCluster[];
}

type CheckState = 'green' | 'failing' | 'pending' | 'other';

function checkState(conclusion: CheckConclusion): CheckState {
  switch (conclusion) {
    case 'success':
    case 'neutral':
      return 'green';
    case 'failure':
    case 'timed_out':
      return 'failing';
    case 'pending':
    case 'action_required':
      return 'pending';
    case 'cancelled':
      return 'other';
  }
}

/** Completion instant (ms), or null when the check carries no usable timestamp. */
function endTime(check: CheckRecord): number | null {
  const iso = check.completedAt ?? check.startedAt;
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

/** Start instant (ms), or null when the check carries no usable timestamp. */
function beginTime(check: CheckRecord): number | null {
  const iso = check.startedAt ?? check.completedAt;
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

interface PrCi {
  readonly everFailed: boolean;
  readonly reachedGreen: boolean;
  readonly timeToGreenSeconds: number | null;
  readonly cycles: number;
  readonly failingCheckNames: readonly string[];
}

/** Compute one PR's CI story, or null when the PR has no checks (excluded, not "green"). */
function prCi(pull: PullRecord, checks: readonly CheckRecord[]): PrCi | null {
  // A PR's checks are the runs on any SHA it has had as head. In the rare case two
  // PRs share a head SHA, a check on it is attributed to both — acceptable for v1.
  const own = checks
    .filter((check) => check.repo === pull.repo && pull.headShas.includes(check.headSha))
    .sort(
      (a, b) => (endTime(a) ?? Number.POSITIVE_INFINITY) - (endTime(b) ?? Number.POSITIVE_INFINITY),
    );
  if (own.length === 0) return null;

  const everFailed = own.some((check) => checkState(check.conclusion) === 'failing');
  const failingCheckNames = own
    .filter((check) => checkState(check.conclusion) === 'failing')
    .map((check) => check.name);

  // Time-to-green: the first instant at which *every* check name the PR carries has
  // reported and its latest state is green — not merely the first green to complete,
  // which would understate the time when checks finish out of order.
  const allNames = new Set(own.map((check) => check.name));
  const beginTimes = own.map(beginTime).filter((time): time is number => time !== null);
  const firstActivity = beginTimes.length > 0 ? Math.min(...beginTimes) : null;
  const latest = new Map<string, CheckState>();
  let greenAt: number | null = null;
  for (const check of own) {
    latest.set(check.name, checkState(check.conclusion));
    const allGreen =
      latest.size === allNames.size && [...latest.values()].every((s) => s === 'green');
    if (greenAt === null && allGreen) greenAt = endTime(check);
  }
  const reachedGreen = greenAt !== null;
  const timeToGreenSeconds =
    greenAt === null || firstActivity === null
      ? null
      : Math.max(0, (greenAt - firstActivity) / 1000);

  // Cycles: a failing run of a check name later followed by a success of the same name
  // (captures both same-SHA re-runs and force-pushed retries — "agent kicked CI").
  let cycles = 0;
  for (const name of new Set(own.map((check) => check.name))) {
    const runs = own.filter((check) => check.name === name);
    let seenSuccessLater = false;
    for (let i = runs.length - 1; i >= 0; i--) {
      const run = runs[i];
      if (!run) continue;
      const state = checkState(run.conclusion);
      if (state === 'green') seenSuccessLater = true;
      else if (state === 'failing' && seenSuccessLater) cycles += 1;
    }
  }

  return { everFailed, reachedGreen, timeToGreenSeconds, cycles, failingCheckNames };
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx] ?? 0;
}

function aggregate(cis: readonly PrCi[]): CiHealthStat {
  const prs = cis.length;
  const failedPrs = cis.filter((ci) => ci.everFailed).length;
  const greenPrs = cis.filter((ci) => ci.reachedGreen).length;
  const greenTimes = cis
    .map((ci) => ci.timeToGreenSeconds)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const totalCycles = cis.reduce((sum, ci) => sum + ci.cycles, 0);
  const enough = prs >= MIN_PRS_FOR_RATE;

  return {
    prs,
    failedPrs,
    greenPrs,
    failureRate: enough ? failedPrs / prs : null,
    p50TimeToGreenSeconds: enough && greenTimes.length > 0 ? percentile(greenTimes, 0.5) : null,
    p95TimeToGreenSeconds: enough && greenTimes.length > 0 ? percentile(greenTimes, 0.95) : null,
    totalCycles,
    avgCycles: enough ? totalCycles / prs : null,
  };
}

/** Roll PRs + checks up into agent/human CI health for one repo or the whole fleet. */
export function ciHealth(
  pulls: readonly PullRecord[],
  checks: readonly CheckRecord[],
  window: ProvenanceWindow,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): CiHealth {
  const agentCis: PrCi[] = [];
  const humanCis: PrCi[] = [];
  const failuresByCheck = new Map<string, number>();

  for (const pull of pulls) {
    if (!inWindow(pull.createdAt, window)) continue;
    const ci = prCi(pull, checks);
    if (!ci) continue;
    if (classifyPull(pull, config).provenance === 'agent') {
      agentCis.push(ci);
      for (const name of ci.failingCheckNames) {
        failuresByCheck.set(name, (failuresByCheck.get(name) ?? 0) + 1);
      }
    } else {
      humanCis.push(ci);
    }
  }

  return {
    agent: aggregate(agentCis),
    human: aggregate(humanCis),
    failuresByCheck: [...failuresByCheck.entries()]
      .map(([name, failures]) => ({ name, failures }))
      .sort((a, b) => b.failures - a.failures),
  };
}

/** Per-repo CI health, keyed by `owner/name`. */
export function ciHealthByRepo(
  pulls: readonly PullRecord[],
  checks: readonly CheckRecord[],
  window: ProvenanceWindow,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): Record<string, CiHealth> {
  const repos = new Set<string>();
  for (const pull of pulls) repos.add(pull.repo);

  const out: Record<string, CiHealth> = {};
  for (const repo of repos) {
    out[repo] = ciHealth(
      pulls.filter((pull) => pull.repo === repo),
      checks.filter((check) => check.repo === repo),
      window,
      config,
    );
  }
  return out;
}
