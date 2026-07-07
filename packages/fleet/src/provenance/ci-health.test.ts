import { describe, expect, it } from 'vitest';
import type { CheckConclusion, CheckRecord, PullRecord } from '../model/github.js';
import { ciHealth, ciHealthByRepo, MIN_PRS_FOR_RATE } from './ci-health.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' };

function pull(number: number, over: Partial<PullRecord> = {}): PullRecord {
  const headSha = over.headSha ?? `s${number}`;
  return {
    number,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha,
    headShas: [headSha],
    branch: 'claude/agent-work',
    authorLogin: 'a-person',
    createdAt: '2026-06-10T00:00:00.000Z',
    mergedAt: '2026-06-11T00:00:00.000Z',
    additions: 10,
    deletions: 0,
    reviewStates: [],
    ...over,
  };
}

function check(
  headSha: string,
  conclusion: CheckConclusion,
  startedAt: string,
  completedAt: string | null,
  name = 'ci',
): CheckRecord {
  return { repo: 'acme/widgets', headSha, name, conclusion, startedAt, completedAt };
}

// Three agent PRs with checks + one check-less agent PR (excluded), one human PR.
function setup() {
  const pulls = [
    pull(1, { headSha: 's1', headShas: ['s1'] }), // red then green (re-run)
    pull(2, { headSha: 's2', headShas: ['s2'] }), // green first try
    pull(3, { headSha: 'sB', headShas: ['sA', 'sB'] }), // red on sA, force-pushed green on sB
    pull(4, { headSha: 's4', headShas: ['s4'] }), // no checks → excluded
    pull(5, { branch: 'feature/manual', headSha: 's5', headShas: ['s5'] }), // human
  ];
  const checks = [
    check('s1', 'failure', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
    check('s1', 'success', '2026-06-10T10:30:00.000Z', '2026-06-10T11:00:00.000Z'),
    check('s2', 'success', '2026-06-10T09:30:00.000Z', '2026-06-10T10:00:00.000Z'),
    check('sA', 'failure', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
    check('sB', 'success', '2026-06-10T11:30:00.000Z', '2026-06-10T12:00:00.000Z'),
    check('s5', 'success', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
  ];
  return { pulls, checks };
}

describe('ciHealth', () => {
  it('counts only classified PRs that have checks (excludes the check-less PR)', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.agent.prs).toBe(3); // PRs 1, 2, 3 — not 4 (no checks)
    expect(health.human.prs).toBe(1);
  });

  it('counts a force-pushed-away red as a failure', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.agent.failedPrs).toBe(2); // PR1 (re-run) and PR3 (force-push)
    expect(health.agent.failureRate).toBeCloseTo(2 / 3);
  });

  it('computes time-to-green percentiles from first activity to first all-green', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    // green times: PR2 1800s, PR1 7200s, PR3 10800s → p50 = 7200, p95 = 10800.
    expect(health.agent.p50TimeToGreenSeconds).toBe(7200);
    expect(health.agent.p95TimeToGreenSeconds).toBe(10800);
  });

  it('counts one red→green cycle per PR that failed then passed the same check', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.agent.totalCycles).toBe(2); // PR1 + PR3
    expect(health.agent.avgCycles).toBeCloseTo(2 / 3);
  });

  it('clusters agent failures by check name', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.failuresByCheck).toEqual([{ name: 'ci', failures: 2 }]);
  });

  it('reports null rates below the PR threshold (tiered truth)', () => {
    const twoAgentPrs = [
      pull(1, { headSha: 's1', headShas: ['s1'] }),
      pull(2, { headSha: 's2', headShas: ['s2'] }),
    ];
    const checks = [
      check('s1', 'failure', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
      check('s2', 'success', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
    ];
    expect(twoAgentPrs.length).toBeLessThan(MIN_PRS_FOR_RATE);
    const health = ciHealth(twoAgentPrs, checks, WINDOW);
    expect(health.agent.prs).toBe(2);
    expect(health.agent.failureRate).toBeNull();
    expect(health.agent.p50TimeToGreenSeconds).toBeNull();
    expect(health.agent.avgCycles).toBeNull();
  });

  it('keeps the human baseline an anonymous aggregate — no per-person field', () => {
    const { pulls, checks } = setup();
    const health = ciHealth(pulls, checks, WINDOW);
    const personKeys = ['login', 'email', 'user', 'author', 'name'];
    for (const key of Object.keys(health.human)) {
      expect(personKeys).not.toContain(key.toLowerCase());
    }
  });

  it('waits for every check name before calling a PR green (out-of-order completion)', () => {
    // Each PR: fast `lint` green at +10s, slow `test` green at +600s. Green is 600s, not 10s.
    const pulls = [1, 2, 3].map((n) => pull(n, { headSha: `s${n}`, headShas: [`s${n}`] }));
    const checks = pulls.flatMap((p) => [
      check(p.headSha, 'success', '2026-06-10T09:00:00.000Z', '2026-06-10T09:00:10.000Z', 'lint'),
      check(p.headSha, 'success', '2026-06-10T09:00:00.000Z', '2026-06-10T09:10:00.000Z', 'test'),
    ]);
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.agent.p50TimeToGreenSeconds).toBe(600);
    expect(health.agent.greenPrs).toBe(3);
  });

  it('surfaces never-green PRs (only cancelled checks) instead of folding them into pass', () => {
    const pulls = [1, 2, 3].map((n) => pull(n, { headSha: `s${n}`, headShas: [`s${n}`] }));
    const checks = pulls.map((p) =>
      check(p.headSha, 'cancelled', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'),
    );
    const health = ciHealth(pulls, checks, WINDOW);
    expect(health.agent.prs).toBe(3);
    expect(health.agent.failedPrs).toBe(0);
    expect(health.agent.greenPrs).toBe(0); // none actually passed CI
  });

  it('excludes PRs created outside the window', () => {
    const pulls = [pull(1, { createdAt: '2026-01-01T00:00:00.000Z' })];
    const checks = [check('s1', 'success', '2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z')];
    expect(ciHealth(pulls, checks, WINDOW).agent.prs).toBe(0);
  });
});

describe('ciHealthByRepo', () => {
  it('groups CI health per repo slug', () => {
    const pulls = [
      pull(1, { repo: 'acme/widgets', headSha: 'w1', headShas: ['w1'] }),
      pull(2, { repo: 'acme/api', headSha: 'a1', headShas: ['a1'] }),
    ];
    const checks = [
      {
        repo: 'acme/widgets',
        headSha: 'w1',
        name: 'ci',
        conclusion: 'success' as CheckConclusion,
        startedAt: null,
        completedAt: '2026-06-10T10:00:00.000Z',
      },
      {
        repo: 'acme/api',
        headSha: 'a1',
        name: 'ci',
        conclusion: 'failure' as CheckConclusion,
        startedAt: null,
        completedAt: '2026-06-10T10:00:00.000Z',
      },
    ];
    const byRepo = ciHealthByRepo(pulls, checks, WINDOW);
    expect(byRepo['acme/widgets']?.agent.failedPrs).toBe(0);
    expect(byRepo['acme/api']?.agent.failedPrs).toBe(1);
  });
});
