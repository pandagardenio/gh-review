import { describe, expect, it } from 'vitest';
import type { PullRecord } from '../model/github.js';
import { provenanceTrend } from './trend.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-06-08T00:00:00.000Z' };

function mergedPull(number: number, branch: string, mergedAt: string): PullRecord {
  return {
    number,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha: 's',
    headShas: ['s'],
    branch,
    authorLogin: 'a-person',
    createdAt: mergedAt,
    mergedAt,
    additions: 10,
    deletions: 0,
    reviewStates: [],
  };
}

describe('provenanceTrend', () => {
  it('produces one point per day across a 7-day window', () => {
    const points = provenanceTrend([], [], WINDOW, 'day');
    expect(points).toHaveLength(7);
    expect(points[0]?.start).toBe('2026-06-01T00:00:00.000Z');
  });

  it('produces a single point for a week bucket spanning the window', () => {
    const points = provenanceTrend([], [], WINDOW, 'week');
    expect(points).toHaveLength(1);
  });

  it('places each PR in its own day bucket', () => {
    const pulls = [
      mergedPull(1, 'claude/a', '2026-06-01T09:00:00.000Z'),
      mergedPull(2, 'feature/b', '2026-06-03T09:00:00.000Z'),
    ];
    const points = provenanceTrend([], pulls, WINDOW, 'day');
    expect(points[0]?.prShare).toBe(1); // day 1: the one agent PR
    expect(points[1]?.prShare).toBeNull(); // day 2: nothing merged
    expect(points[2]?.prShare).toBe(0); // day 3: the one human PR
  });

  it('returns an empty series for an invalid or empty window', () => {
    expect(provenanceTrend([], [], { since: WINDOW.until, until: WINDOW.since }, 'day')).toEqual(
      [],
    );
    expect(provenanceTrend([], [], { since: 'nonsense', until: 'also' }, 'day')).toEqual([]);
  });
});
