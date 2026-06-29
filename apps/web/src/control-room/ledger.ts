/**
 * Ledger roll-ups — the Observe pane's arithmetic, ported from the factory's
 * `scripts/factory/metrics.sh` and `failures.sh`.
 *
 * Pure functions over {@link RunRecord}s: no DOM, no network. Terminal stats
 * exclude `running` Runs; token fields may be null and are simply skipped.
 */

import type { RunRecord, RunStatus, Station } from './source.js';
import { STATION_ORDER } from './source.js';

const TERMINAL: readonly RunStatus[] = ['success', 'failure', 'escalated'];

export interface StationStat {
  readonly station: Station;
  readonly runs: number;
  readonly success: number;
  readonly failure: number;
  readonly escalated: number;
  readonly running: number;
  readonly successRate: number;
  readonly p50Seconds: number;
  readonly p95Seconds: number;
}

export interface FailureCluster {
  readonly reason: string;
  readonly count: number;
  readonly stations: readonly Station[];
}

export interface LedgerSummary {
  readonly totalRuns: number;
  readonly byStatus: Record<RunStatus, number>;
  readonly successRate: number;
  readonly tokens: number;
  readonly toolCalls: number;
  readonly wallSeconds: number;
  readonly stations: readonly StationStat[];
  readonly failures: readonly FailureCluster[];
}

const isTerminal = (status: RunStatus): boolean => TERMINAL.includes(status);

function percentile(sortedSeconds: readonly number[], p: number): number {
  if (sortedSeconds.length === 0) return 0;
  const idx = Math.min(sortedSeconds.length - 1, Math.floor(p * sortedSeconds.length));
  return sortedSeconds[idx] ?? 0;
}

function emptyStatus(): Record<RunStatus, number> {
  return { running: 0, success: 0, failure: 0, escalated: 0 };
}

function stationStat(station: Station, runs: readonly RunRecord[]): StationStat {
  const counts = emptyStatus();
  for (const run of runs) counts[run.status] += 1;
  const terminal = counts.success + counts.failure + counts.escalated;
  const seconds = runs.map((r) => r.usage.wallSeconds).sort((a, b) => a - b);
  return {
    station,
    runs: runs.length,
    success: counts.success,
    failure: counts.failure,
    escalated: counts.escalated,
    running: counts.running,
    successRate: terminal === 0 ? 0 : counts.success / terminal,
    p50Seconds: percentile(seconds, 0.5),
    p95Seconds: percentile(seconds, 0.95),
  };
}

/** Cluster failed/escalated Runs by `failureReason`, busiest first. */
export function clusterFailures(runs: readonly RunRecord[]): FailureCluster[] {
  const byReason = new Map<string, { count: number; stations: Set<Station> }>();
  for (const run of runs) {
    if (run.status !== 'failure' && run.status !== 'escalated') continue;
    const reason = run.failureReason ?? 'unknown';
    const entry = byReason.get(reason) ?? { count: 0, stations: new Set<Station>() };
    entry.count += 1;
    entry.stations.add(run.station);
    byReason.set(reason, entry);
  }
  return [...byReason.entries()]
    .map(([reason, e]) => ({ reason, count: e.count, stations: [...e.stations] }))
    .sort((a, b) => b.count - a.count);
}

/** Roll a ledger up into the numbers the Observe pane shows. */
export function summarize(runs: readonly RunRecord[]): LedgerSummary {
  const byStatus = emptyStatus();
  let tokens = 0;
  let toolCalls = 0;
  let wallSeconds = 0;
  for (const run of runs) {
    byStatus[run.status] += 1;
    tokens += (run.usage.tokensIn ?? 0) + (run.usage.tokensOut ?? 0);
    toolCalls += run.usage.toolCalls;
    wallSeconds += run.usage.wallSeconds;
  }
  const terminal = runs.filter((r) => isTerminal(r.status));
  const successRate = terminal.length === 0 ? 0 : byStatus.success / terminal.length;

  const stations: StationStat[] = [];
  for (const station of STATION_ORDER) {
    const stationRuns = runs.filter((r) => r.station === station);
    if (stationRuns.length > 0) stations.push(stationStat(station, stationRuns));
  }

  return {
    totalRuns: runs.length,
    byStatus,
    successRate,
    tokens,
    toolCalls,
    wallSeconds,
    stations,
    failures: clusterFailures(runs),
  };
}
