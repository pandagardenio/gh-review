/**
 * Harness-health score (BL-024): one per-repo number a lead can rank a fleet by —
 * "is this project's harness working?" — composed from four components, two
 * baseline-tier and two rich-tier:
 *
 * - **agent-ci** — agent PRs' CI failure rate (BL-023).            [baseline]
 * - **review-escalation** — share of agent PRs asked to change.    [baseline]
 * - **session-outcome** — session failure/escalation rate.         [rich]
 * - **hook-friction** — hook blocks per session.                   [rich]
 *
 * Each component yields a `health` in [0, 1] (1 = healthy); the score is the
 * weighted mean over *available* components, renormalized by their weights.
 *
 * Constitution: this **strains tiered-truth (principle 2)** by design — a composite
 * invites hiding gaps — so it is explicitly *partial-aware*. Every result lists
 * which components were `missing`, is tagged `full` / `partial` / `unknown`, and is
 * `null` below {@link MIN_COMPONENTS}. A silently degraded score is exactly the
 * confident-but-wrong failure mode we refuse (Triage principle 5). No component
 * measures a person (principle 1) — sessions aggregate by agent, PRs by provenance.
 */

import type { CheckRecord, PullRecord } from '../model/github.js';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import type { AgentIdentityConfig } from '../provenance/agent-identity.js';
import { classifyPull, DEFAULT_AGENT_IDENTITY } from '../provenance/agent-identity.js';
import { ciHealth, MIN_PRS_FOR_RATE } from '../provenance/ci-health.js';
import type { ProvenanceWindow } from '../provenance/share.js';
import { inWindow } from '../provenance/share.js';

export type ComponentKey = 'agent-ci' | 'session-outcome' | 'review-escalation' | 'hook-friction';
export type HarnessTier = 'baseline' | 'rich';
export type HarnessStatus = 'full' | 'partial' | 'unknown';
export type HarnessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** The raw data one repo's score is computed from. Rich fields are null when uninstrumented. */
export interface HarnessInput {
  readonly pulls: readonly PullRecord[];
  readonly checks: readonly CheckRecord[];
  readonly sessions: readonly SessionRecord[] | null;
  readonly hookEvents: readonly HookEventRecord[] | null;
}

export interface HealthComponent {
  readonly key: ComponentKey;
  readonly tier: HarnessTier;
  readonly weight: number;
  readonly available: boolean;
  /** 0..1, higher = healthier; null when unavailable. */
  readonly health: number | null;
  /** Human-readable receipt, so the score always links back to its evidence. */
  readonly detail: string;
}

export interface HarnessHealth {
  /** 0..1 weighted mean over available components, or null below the minimum. */
  readonly score: number | null;
  readonly grade: HarnessGrade | null;
  readonly status: HarnessStatus;
  readonly components: readonly HealthComponent[];
  readonly missing: readonly ComponentKey[];
}

/**
 * Component weights — **product surface**, like the categorization rules (MVP.md §3).
 * A change here is a deliberate, visible diff (covered by a test). Sum need not be 1;
 * the score renormalizes by whichever components are available.
 */
export const HARNESS_WEIGHTS: Record<ComponentKey, number> = {
  'agent-ci': 0.35,
  'session-outcome': 0.3,
  'review-escalation': 0.2,
  'hook-friction': 0.15,
};

/** Fewer available components than this ⇒ no confident composite; score is null. */
export const MIN_COMPONENTS = 2;

const pct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

function gradeOf(score: number): HarnessGrade {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.6) return 'C';
  if (score >= 0.4) return 'D';
  return 'F';
}

function unavailable(
  key: ComponentKey,
  tier: HarnessTier,
  weight: number,
  detail: string,
): HealthComponent {
  return { key, tier, weight, available: false, health: null, detail };
}

function agentCiComponent(
  input: HarnessInput,
  window: ProvenanceWindow,
  config: AgentIdentityConfig,
  weight: number,
): HealthComponent {
  const rate = ciHealth(input.pulls, input.checks, window, config).agent.failureRate;
  if (rate === null)
    return unavailable('agent-ci', 'baseline', weight, 'agent CI failure — too few PRs');
  return {
    key: 'agent-ci',
    tier: 'baseline',
    weight,
    available: true,
    health: 1 - rate,
    detail: `agent CI failure ${pct(rate)}`,
  };
}

function reviewEscalationComponent(
  input: HarnessInput,
  window: ProvenanceWindow,
  config: AgentIdentityConfig,
  weight: number,
): HealthComponent {
  const agentPulls = input.pulls.filter(
    (pull) => inWindow(pull.createdAt, window) && classifyPull(pull, config).provenance === 'agent',
  );
  if (agentPulls.length < MIN_PRS_FOR_RATE) {
    return unavailable('review-escalation', 'baseline', weight, 'review escalation — too few PRs');
  }
  const escalated = agentPulls.filter((pull) =>
    pull.reviewStates.includes('changes_requested'),
  ).length;
  const rate = escalated / agentPulls.length;
  return {
    key: 'review-escalation',
    tier: 'baseline',
    weight,
    available: true,
    health: 1 - rate,
    detail: `changes-requested on ${pct(rate)} of agent PRs`,
  };
}

function sessionOutcomeComponent(
  input: HarnessInput,
  window: ProvenanceWindow,
  weight: number,
): HealthComponent {
  if (input.sessions === null)
    return unavailable('session-outcome', 'rich', weight, 'no ledger — sessions unknown');
  const terminal = input.sessions.filter(
    (session) => inWindow(session.startedAt, window) && session.status !== 'running',
  );
  if (terminal.length === 0)
    return unavailable('session-outcome', 'rich', weight, 'no terminal sessions in window');
  const bad = terminal.filter((s) => s.status === 'failure' || s.status === 'escalated').length;
  const rate = bad / terminal.length;
  return {
    key: 'session-outcome',
    tier: 'rich',
    weight,
    available: true,
    health: 1 - rate,
    detail: `${pct(rate)} of sessions failed or escalated`,
  };
}

function hookFrictionComponent(
  input: HarnessInput,
  window: ProvenanceWindow,
  weight: number,
): HealthComponent {
  if (input.sessions === null || input.hookEvents === null) {
    return unavailable('hook-friction', 'rich', weight, 'no ledger — hook friction unknown');
  }
  const sessions = input.sessions.filter((session) => inWindow(session.startedAt, window));
  if (sessions.length === 0)
    return unavailable('hook-friction', 'rich', weight, 'no sessions in window');
  const blocks = input.hookEvents.filter(
    (h) => h.outcome === 'block' && inWindow(h.at, window),
  ).length;
  const perSession = blocks / sessions.length;
  // Normalize blocks-per-session to (0,1]: 0 → 1, 1/session → 0.5, 3/session → 0.25.
  const health = 1 / (1 + perSession);
  return {
    key: 'hook-friction',
    tier: 'rich',
    weight,
    available: true,
    health,
    detail: `${perSession.toFixed(2)} hook blocks per session`,
  };
}

/** Compute the four components for one repo. Rich components are unavailable without a ledger. */
export function harnessHealthComponents(
  input: HarnessInput,
  window: ProvenanceWindow,
  weights: Record<ComponentKey, number> = HARNESS_WEIGHTS,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): HealthComponent[] {
  return [
    agentCiComponent(input, window, config, weights['agent-ci']),
    sessionOutcomeComponent(input, window, weights['session-outcome']),
    reviewEscalationComponent(input, window, config, weights['review-escalation']),
    hookFrictionComponent(input, window, weights['hook-friction']),
  ];
}

/** Fold components into a score — the partial-aware composite (`harnessHealth(components)`). */
export function scoreComponents(components: readonly HealthComponent[]): HarnessHealth {
  const available = components.filter((c) => c.available && c.health !== null);
  const missing = components.filter((c) => !c.available).map((c) => c.key);

  if (available.length < MIN_COMPONENTS) {
    return { score: null, grade: null, status: 'unknown', components, missing };
  }
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const score =
    totalWeight > 0
      ? available.reduce((sum, c) => sum + c.weight * (c.health as number), 0) / totalWeight
      : null;
  const status: HarnessStatus = available.length === components.length ? 'full' : 'partial';
  return { score, grade: score === null ? null : gradeOf(score), status, components, missing };
}

/** Compute a repo's harness health from its raw data. */
export function harnessHealth(
  input: HarnessInput,
  window: ProvenanceWindow,
  weights: Record<ComponentKey, number> = HARNESS_WEIGHTS,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): HarnessHealth {
  return scoreComponents(harnessHealthComponents(input, window, weights, config));
}

export interface RepoHarness {
  readonly repo: string;
  readonly health: HarnessHealth;
}

/**
 * Rank repos worst-actionable-first within comparability tiers: `full` repos
 * (by score), then `partial`, then `unknown` last — never interleaving a
 * partial or unknown score with a full one as if they were comparable. Within a
 * tier, higher score ranks first (a lead scanning top-down sees the confident,
 * complete health picture before the caveated ones).
 */
export function rankByHarnessHealth(entries: readonly RepoHarness[]): RepoHarness[] {
  const tier = (status: HarnessStatus): number =>
    status === 'full' ? 0 : status === 'partial' ? 1 : 2;
  return [...entries].sort((a, b) => {
    const byTier = tier(a.health.status) - tier(b.health.status);
    if (byTier !== 0) return byTier;
    return (b.health.score ?? -1) - (a.health.score ?? -1);
  });
}
