import { describe, expect, it } from 'vitest';
import type { CommitRecord, PullRecord } from '../model/github.js';
import { inWindow, provenanceByRepo, provenanceShare, windowEndingAt } from './share.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' };
const CLAUDE = 'Co-Authored-By: Claude <noreply@anthropic.com>';

function commit(over: Partial<CommitRecord>): CommitRecord {
  return {
    sha: 's',
    repo: 'acme/widgets',
    message: 'chore: x',
    authorLogin: 'a-person',
    committedAt: '2026-06-15T10:00:00.000Z',
    additions: 100,
    deletions: 0,
    ...over,
  };
}

function pull(over: Partial<PullRecord>): PullRecord {
  return {
    number: 1,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha: 's',
    branch: 'feature/manual',
    authorLogin: 'a-person',
    createdAt: '2026-06-10T10:00:00.000Z',
    mergedAt: '2026-06-15T10:00:00.000Z',
    additions: 10,
    deletions: 2,
    reviewStates: [],
    ...over,
  };
}

describe('provenanceShare', () => {
  it('computes PR share from merged PRs in the window', () => {
    const pulls = [
      pull({ number: 1, branch: 'claude/a' }),
      pull({ number: 2, branch: 'feature/b' }),
    ];
    const share = provenanceShare([], pulls, WINDOW);
    expect(share.mergedPrs).toBe(2);
    expect(share.agentPrs).toBe(1);
    expect(share.prShare).toBe(0.5);
  });

  it('ignores unmerged PRs and PRs merged outside the window', () => {
    const pulls = [
      pull({ number: 1, state: 'open', mergedAt: null }),
      pull({ number: 2, mergedAt: '2026-01-01T00:00:00.000Z' }),
      pull({ number: 3, branch: 'claude/x' }),
    ];
    const share = provenanceShare([], pulls, WINDOW);
    expect(share.mergedPrs).toBe(1);
    expect(share.agentPrs).toBe(1);
  });

  it('computes line share from commit additions + deletions', () => {
    const commits = [
      commit({ sha: 'a', message: `feat\n\n${CLAUDE}`, additions: 300, deletions: 0 }),
      commit({ sha: 'b', additions: 100, deletions: 0 }),
    ];
    const share = provenanceShare(commits, [], WINDOW);
    expect(share.totalLines).toBe(400);
    expect(share.agentLines).toBe(300);
    expect(share.lineShare).toBe(0.75);
  });

  it('excludes commits with absent stats from the line denominator, not zeroes them', () => {
    const commits = [
      commit({ sha: 'a', message: `feat\n\n${CLAUDE}`, additions: 200, deletions: 0 }),
      commit({ sha: 'b', additions: null, deletions: null }),
    ];
    const share = provenanceShare(commits, [], WINDOW);
    expect(share.linedCommits).toBe(1);
    expect(share.totalLines).toBe(200);
    expect(share.lineShare).toBe(1);
  });

  it('reports null (not NaN) shares for an empty window', () => {
    const share = provenanceShare([], [], WINDOW);
    expect(share.prShare).toBeNull();
    expect(share.lineShare).toBeNull();
    expect(share.byAgent).toEqual([]);
  });

  it('breaks the agent contribution down by agent, busiest first', () => {
    const commits = [
      commit({ sha: 'a', message: `feat\n\n${CLAUDE}`, additions: 100, deletions: 0 }),
      commit({ sha: 'b', authorLogin: 'github-actions[bot]', additions: 300, deletions: 0 }),
    ];
    const share = provenanceShare(commits, [], WINDOW);
    expect(share.byAgent.map((a) => a.agent)).toEqual(['github-actions', 'claude-code']);
  });
});

describe('provenanceByRepo', () => {
  it('groups shares per repo slug', () => {
    const commits = [
      commit({ repo: 'acme/widgets', message: `x\n\n${CLAUDE}`, additions: 100, deletions: 0 }),
      commit({ repo: 'acme/api', additions: 100, deletions: 0 }),
    ];
    const byRepo = provenanceByRepo(commits, [], WINDOW);
    expect(byRepo['acme/widgets']?.lineShare).toBe(1);
    expect(byRepo['acme/api']?.lineShare).toBe(0);
  });
});

describe('inWindow / windowEndingAt', () => {
  it('treats the window as half-open [since, until)', () => {
    expect(inWindow(WINDOW.since, WINDOW)).toBe(true);
    expect(inWindow(WINDOW.until, WINDOW)).toBe(false);
    expect(inWindow(null, WINDOW)).toBe(false);
  });

  it('compares by instant, not lexically, across timestamp precisions', () => {
    const w = { since: '2026-06-20T00:00:00.000Z', until: '2026-06-20T18:30:45.500Z' };
    // Seconds-precision record that is numerically inside the ms-precision boundary.
    expect(inWindow('2026-06-20T18:30:45Z', w)).toBe(true);
  });

  it('builds a window of N days ending at now', () => {
    const w = windowEndingAt('2026-07-01T00:00:00.000Z', 30);
    expect(w.until).toBe('2026-07-01T00:00:00.000Z');
    expect(w.since).toBe('2026-06-01T00:00:00.000Z');
  });
});
