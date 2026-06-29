import { describe, expect, it } from 'vitest';
import { clusterFailures, summarize } from './ledger.js';
import type { RunRecord, RunStatus, Station } from './source.js';

function run(
  station: Station,
  status: RunStatus,
  wallSeconds: number,
  failureReason: string | null = null,
): RunRecord {
  return {
    id: `${station}-${status}-${wallSeconds}`,
    workItemId: 1,
    station,
    status,
    startedAt: '2026-06-28T00:00:00.000Z',
    endedAt: status === 'running' ? null : '2026-06-28T00:05:00.000Z',
    failureReason,
    usage: { tokensIn: 100, tokensOut: 50, wallSeconds, toolCalls: 3 },
    pr: null,
  };
}

describe('summarize', () => {
  it('rolls up totals, spend, and success rate over terminal runs', () => {
    const s = summarize([
      run('intake', 'success', 30),
      run('implement', 'success', 600),
      run('implement', 'failure', 120, 'ci-failed'),
      run('qa', 'running', 90),
    ]);
    expect(s.totalRuns).toBe(4);
    expect(s.byStatus.success).toBe(2);
    expect(s.byStatus.running).toBe(1);
    expect(s.tokens).toBe(4 * 150);
    expect(s.toolCalls).toBe(12);
    expect(s.wallSeconds).toBe(840);
    // success rate excludes the running run: 2 success / 3 terminal.
    expect(s.successRate).toBeCloseTo(2 / 3, 5);
  });

  it('orders station stats by the canonical pipeline and computes rates', () => {
    const s = summarize([
      run('qa', 'success', 10),
      run('intake', 'success', 10),
      run('intake', 'failure', 10, 'tool-denied'),
    ]);
    expect(s.stations.map((st) => st.station)).toEqual(['intake', 'qa']);
    const intake = s.stations.find((st) => st.station === 'intake');
    expect(intake?.runs).toBe(2);
    expect(intake?.successRate).toBeCloseTo(0.5, 5);
  });

  it('returns an empty station list when there are no runs', () => {
    const s = summarize([]);
    expect(s.totalRuns).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.stations).toEqual([]);
  });
});

describe('clusterFailures', () => {
  it('groups failed and escalated runs by reason, busiest first', () => {
    const clusters = clusterFailures([
      run('implement', 'failure', 10, 'ci-failed'),
      run('qa', 'failure', 10, 'ci-failed'),
      run('spec', 'escalated', 10, 'needs-human'),
      run('plan', 'success', 10),
    ]);
    expect(clusters[0]).toMatchObject({ reason: 'ci-failed', count: 2 });
    expect(clusters[0]?.stations).toContain('implement');
    expect(clusters[0]?.stations).toContain('qa');
    expect(clusters.find((c) => c.reason === 'needs-human')?.count).toBe(1);
  });

  it('defaults a missing reason to "unknown"', () => {
    const clusters = clusterFailures([run('implement', 'failure', 10, null)]);
    expect(clusters[0]?.reason).toBe('unknown');
  });
});
