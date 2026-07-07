import { describe, expect, it } from 'vitest';
import type { CheckConclusion, CheckRecord, PullRecord } from '../model/github.js';
import type { HookEventRecord, SessionRecord, SessionStatus } from '../model/session.js';
import {
  type ComponentKey,
  HARNESS_WEIGHTS,
  type HarnessHealth,
  type HealthComponent,
  harnessHealth,
  rankByHarnessHealth,
  scoreComponents,
} from './harness-health.js';

const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' };

const BASELINE: ComponentKey[] = ['agent-ci', 'review-escalation'];
function comp(key: ComponentKey, weight: number, health: number | null): HealthComponent {
  return {
    key,
    tier: BASELINE.includes(key) ? 'baseline' : 'rich',
    weight,
    available: health !== null,
    health,
    detail: '',
  };
}

describe('scoreComponents', () => {
  it('produces a full score from all four components (weighted mean)', () => {
    const result = scoreComponents([
      comp('agent-ci', 0.35, 1),
      comp('session-outcome', 0.3, 0.5),
      comp('review-escalation', 0.2, 1),
      comp('hook-friction', 0.15, 0),
    ]);
    expect(result.status).toBe('full');
    expect(result.score).toBeCloseTo(0.7); // .35 + .15 + .20 + 0
    expect(result.grade).toBe('C');
    expect(result.missing).toEqual([]);
  });

  it('produces a partial score from the baseline components, listing the missing ones', () => {
    const result = scoreComponents([
      comp('agent-ci', 0.35, 1),
      comp('session-outcome', 0.3, null),
      comp('review-escalation', 0.2, 0.5),
      comp('hook-friction', 0.15, null),
    ]);
    expect(result.status).toBe('partial');
    expect(result.score).toBeCloseTo(0.45 / 0.55); // renormalized over available weights
    expect(result.missing).toEqual(['session-outcome', 'hook-friction']);
  });

  it('reports null (unknown) below the minimum component count', () => {
    const result = scoreComponents([
      comp('agent-ci', 0.35, 1),
      comp('session-outcome', 0.3, null),
      comp('review-escalation', 0.2, null),
      comp('hook-friction', 0.15, null),
    ]);
    expect(result.status).toBe('unknown');
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
  });

  it('judges full/missing against the canonical set, not the passed array length', () => {
    // Only the two baseline components supplied and available — this is NOT full coverage.
    const result = scoreComponents([
      comp('agent-ci', 0.35, 1),
      comp('review-escalation', 0.2, 0.5),
    ]);
    expect(result.status).toBe('partial');
    expect(result.missing).toEqual(['session-outcome', 'hook-friction']);
  });

  it('refuses to score (unknown) when a usable weight is non-finite', () => {
    const result = scoreComponents([
      comp('agent-ci', Number.NaN, 1),
      comp('session-outcome', 0.3, 0.5),
      comp('review-escalation', 0.2, null),
      comp('hook-friction', 0.15, null),
    ]);
    // agent-ci is dropped (NaN weight) → only 1 usable → unknown, not a NaN score.
    expect(result.status).toBe('unknown');
    expect(result.score).toBeNull();
  });
});

describe('HARNESS_WEIGHTS', () => {
  it('has the documented defaults (a weight change must be a deliberate diff)', () => {
    expect(HARNESS_WEIGHTS).toEqual({
      'agent-ci': 0.35,
      'session-outcome': 0.3,
      'review-escalation': 0.2,
      'hook-friction': 0.15,
    });
  });
});

// --- integration over raw data ---

function agentPull(n: number, reviewStates: PullRecord['reviewStates']): PullRecord {
  return {
    number: n,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha: `s${n}`,
    headShas: [`s${n}`],
    branch: 'claude/work',
    authorLogin: 'a-person',
    createdAt: '2026-06-10T00:00:00.000Z',
    mergedAt: '2026-06-11T00:00:00.000Z',
    additions: 10,
    deletions: 0,
    reviewStates,
  };
}

function chk(sha: string, conclusion: CheckConclusion): CheckRecord {
  return {
    repo: 'acme/widgets',
    headSha: sha,
    name: 'ci',
    conclusion,
    startedAt: '2026-06-10T09:00:00.000Z',
    completedAt: '2026-06-10T10:00:00.000Z',
  };
}

function session(id: string, status: SessionStatus): SessionRecord {
  return {
    id,
    repo: 'acme/widgets',
    agent: 'claude-code',
    status,
    startedAt: '2026-06-10T08:00:00.000Z',
    endedAt: status === 'running' ? null : '2026-06-10T09:00:00.000Z',
    heartbeatAt: '2026-06-10T08:30:00.000Z',
    stage: null,
    branch: null,
    pr: null,
    failureReason: null,
    usage: { tokensIn: null, tokensOut: null, wallSeconds: 60, toolCalls: 1 },
  };
}

function block(id: string): HookEventRecord {
  return {
    id,
    sessionId: 's',
    repo: 'acme/widgets',
    hook: 'PreToolUse',
    ruleId: 'file-size',
    outcome: 'block',
    at: '2026-06-10T08:15:00.000Z',
  };
}

const RICH_INPUT = {
  pulls: [agentPull(1, ['changes_requested']), agentPull(2, []), agentPull(3, ['approved'])],
  checks: [chk('s1', 'failure'), chk('s2', 'success'), chk('s3', 'success')],
  sessions: [session('a', 'success'), session('b', 'failure'), session('c', 'escalated')],
  hookEvents: [block('h1'), block('h2')],
};

describe('harnessHealth (integration)', () => {
  it('computes a full score when both tiers have data', () => {
    const result = harnessHealth(RICH_INPUT, WINDOW);
    expect(result.status).toBe('full');
    expect(result.components.every((c) => c.available)).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it('degrades to partial (baseline only) when the rich tier is absent, listing missing', () => {
    const result = harnessHealth({ ...RICH_INPUT, sessions: null, hookEvents: null }, WINDOW);
    expect(result.status).toBe('partial');
    expect(result.missing).toEqual(['session-outcome', 'hook-friction']);
    expect(result.score).not.toBeNull();
  });
});

describe('rankByHarnessHealth', () => {
  it('groups full, then partial, then unknown — never interleaving an unknown above a scored repo', () => {
    const mk = (
      repo: string,
      status: HarnessHealth['status'],
      score: number | null,
    ): {
      repo: string;
      health: HarnessHealth;
    } => ({ repo, health: { score, grade: null, status, components: [], missing: [] } });

    const ranked = rankByHarnessHealth([
      mk('unknownRepo', 'unknown', null),
      mk('partialHigh', 'partial', 0.9),
      mk('fullLow', 'full', 0.6),
      mk('fullHigh', 'full', 0.8),
    ]);
    expect(ranked.map((r) => r.repo)).toEqual([
      'fullHigh',
      'fullLow',
      'partialHigh',
      'unknownRepo',
    ]);
  });
});
