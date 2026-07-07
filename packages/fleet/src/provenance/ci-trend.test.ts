import { describe, expect, it } from 'vitest';
import type { CheckRecord, PullRecord } from '../model/github.js';
import { ciHealthTrend } from './ci-trend.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-06-08T00:00:00.000Z' };

function agentPull(number: number, createdAt: string): PullRecord {
  const headSha = `s${number}`;
  return {
    number,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha,
    headShas: [headSha],
    branch: 'claude/x',
    authorLogin: 'a-person',
    createdAt,
    mergedAt: createdAt,
    additions: 10,
    deletions: 0,
    reviewStates: [],
  };
}

function failedCheck(sha: string, at: string): CheckRecord {
  return {
    repo: 'acme/widgets',
    headSha: sha,
    name: 'ci',
    conclusion: 'failure',
    startedAt: at,
    completedAt: at,
  };
}

describe('ciHealthTrend', () => {
  it('produces one point per day across the window', () => {
    const points = ciHealthTrend([], [], WINDOW, 'day');
    expect(points).toHaveLength(7);
    expect(points[0]?.start).toBe('2026-06-01T00:00:00.000Z');
  });

  it('reports a non-null bucket rate once the bucket clears the PR threshold', () => {
    // Three agent PRs all created on day 1, each failing → day-1 failure rate = 1.
    const pulls = [1, 2, 3].map((n) => agentPull(n, '2026-06-01T09:00:00.000Z'));
    const checks = pulls.map((p) => failedCheck(p.headSha, '2026-06-01T10:00:00.000Z'));
    const points = ciHealthTrend(pulls, checks, WINDOW, 'day');
    expect(points[0]?.agentFailureRate).toBe(1);
    expect(points[1]?.agentFailureRate).toBeNull(); // day 2: no PRs
  });

  it('returns an empty series for an invalid window', () => {
    expect(ciHealthTrend([], [], { since: WINDOW.until, until: WINDOW.since }, 'day')).toEqual([]);
  });
});
