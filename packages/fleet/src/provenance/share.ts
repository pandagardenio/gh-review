/**
 * Provenance roll-ups: the headline "how much of our code is agent-authored"
 * number (BL-022). Pure functions over classified commits and PRs.
 *
 * Two shares, each on its natural unit:
 * - **PR share** — the fraction of merged PRs in the window that are agent
 *   (classified by branch prefix / bot author).
 * - **line share** — the fraction of changed lines (additions + deletions) that
 *   are agent, over commits in the window (classified by trailer / bot author).
 *
 * Tiered-truth discipline (CONTROL-ROOM-CONSTITUTION.md principle 2): an empty
 * denominator reports `null`, never `0` or `NaN`. A commit whose stats the API
 * omitted is excluded from the line-share denominator — not counted as zero lines.
 */

import type { CommitRecord, PullRecord } from '../model/github.js';
import type { AgentIdentityConfig } from './agent-identity.js';
import { classifyCommit, classifyPull, DEFAULT_AGENT_IDENTITY } from './agent-identity.js';

const DAY_MS = 86_400_000;

/** Half-open time window `[since, until)` as ISO-8601 UTC strings. */
export interface ProvenanceWindow {
  readonly since: string;
  readonly until: string;
}

/** Per-agent contribution within a {@link ProvenanceShare}. */
export interface AgentProvenance {
  readonly agent: string;
  readonly prs: number;
  readonly lines: number;
}

export interface ProvenanceShare {
  readonly mergedPrs: number;
  readonly agentPrs: number;
  /** `agentPrs / mergedPrs`, or null when no PR merged in the window. */
  readonly prShare: number | null;
  /** Commits in the window that carried stats (the line-share denominator's basis). */
  readonly linedCommits: number;
  readonly totalLines: number;
  readonly agentLines: number;
  /** `agentLines / totalLines`, or null when no lines with stats in the window. */
  readonly lineShare: number | null;
  /** Per-agent breakdown, busiest (by lines, then PRs) first. */
  readonly byAgent: readonly AgentProvenance[];
}

/**
 * True when an ISO timestamp falls in `[since, until)`. Null (or unparseable)
 * timestamps are out. Compares by instant, not lexically, so records and window
 * boundaries need not share the same sub-second precision.
 */
export function inWindow(iso: string | null, window: ProvenanceWindow): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return at >= Date.parse(window.since) && at < Date.parse(window.until);
}

/** Build a window of `days` ending at `now` (ISO). */
export function windowEndingAt(now: string, days: number): ProvenanceWindow {
  const end = Date.parse(now);
  return { since: new Date(end - days * DAY_MS).toISOString(), until: now };
}

/**
 * Tile a window into `stepDays`-sized sub-windows, left-to-right, the last clamped
 * to the window end. Empty for an invalid or empty window. Shared by the trend
 * roll-ups (provenance and CI health) so bucketing stays identical across them.
 */
export function eachBucketWindow(window: ProvenanceWindow, stepDays: number): ProvenanceWindow[] {
  const start = Date.parse(window.since);
  const end = Date.parse(window.until);
  const step = stepDays * DAY_MS;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || step <= 0) return [];

  const out: ProvenanceWindow[] = [];
  for (let t = start; t < end; t += step) {
    out.push({
      since: new Date(t).toISOString(),
      until: new Date(Math.min(t + step, end)).toISOString(),
    });
  }
  return out;
}

/** Roll commits + PRs up into the provenance share for one repo or the whole fleet. */
export function provenanceShare(
  commits: readonly CommitRecord[],
  pulls: readonly PullRecord[],
  window: ProvenanceWindow,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): ProvenanceShare {
  const byAgent = new Map<string, { prs: number; lines: number }>();
  const bump = (agent: string, key: 'prs' | 'lines', amount: number): void => {
    const entry = byAgent.get(agent) ?? { prs: 0, lines: 0 };
    entry[key] += amount;
    byAgent.set(agent, entry);
  };

  let mergedPrs = 0;
  let agentPrs = 0;
  for (const pull of pulls) {
    if (pull.state !== 'merged' || !inWindow(pull.mergedAt, window)) continue;
    mergedPrs += 1;
    const cls = classifyPull(pull, config);
    if (cls.provenance === 'agent' && cls.agent) {
      agentPrs += 1;
      bump(cls.agent, 'prs', 1);
    }
  }

  let linedCommits = 0;
  let totalLines = 0;
  let agentLines = 0;
  for (const commit of commits) {
    if (!inWindow(commit.committedAt, window)) continue;
    if (commit.additions === null || commit.deletions === null) continue; // excluded, not zeroed
    const lines = commit.additions + commit.deletions;
    linedCommits += 1;
    totalLines += lines;
    const cls = classifyCommit(commit, config);
    if (cls.provenance === 'agent' && cls.agent) {
      agentLines += lines;
      bump(cls.agent, 'lines', lines);
    }
  }

  return {
    mergedPrs,
    agentPrs,
    prShare: mergedPrs === 0 ? null : agentPrs / mergedPrs,
    linedCommits,
    totalLines,
    agentLines,
    lineShare: totalLines === 0 ? null : agentLines / totalLines,
    byAgent: [...byAgent.entries()]
      .map(([agent, entry]) => ({ agent, prs: entry.prs, lines: entry.lines }))
      .sort((a, b) => b.lines - a.lines || b.prs - a.prs),
  };
}

/** Per-repo provenance shares, keyed by `owner/name`. */
export function provenanceByRepo(
  commits: readonly CommitRecord[],
  pulls: readonly PullRecord[],
  window: ProvenanceWindow,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): Record<string, ProvenanceShare> {
  const repos = new Set<string>();
  for (const commit of commits) repos.add(commit.repo);
  for (const pull of pulls) repos.add(pull.repo);

  const out: Record<string, ProvenanceShare> = {};
  for (const repo of repos) {
    out[repo] = provenanceShare(
      commits.filter((commit) => commit.repo === repo),
      pulls.filter((pull) => pull.repo === repo),
      window,
      config,
    );
  }
  return out;
}
