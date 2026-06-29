/**
 * Baked sample data — the default source, so the cockpit renders something
 * alive with zero config (and so the views are testable without a network).
 * Shapes match the live contracts in {@link ./source.js}.
 */

import { parsePolicy } from './policy.js';
import type {
  FactorySource,
  PolicySummary,
  ReviewItem,
  RunRecord,
  RunStatus,
  Station,
  WorkItem,
} from './source.js';

const POLICY_RAW = `version: 1

concurrency:
  maxConcurrency: 3
  lockTtlMinutes: 10

budgets:
  perWorkItem:
    maxTokens: 500000
    maxToolCalls: 400
    maxWallMinutes: 60
  perDay:
    maxTokens: 5000000

approvalGates:
  - pattern: "infra/**"
    reviewer: human
  - pattern: "migrations/**"
    reviewer: human
  - pattern: ".github/workflows/**"
    reviewer: human
  - pattern: ".factory/policy.yml"
    reviewer: human
  - label: "release"
    reviewer: human
`;

function run(
  id: string,
  workItemId: number,
  station: Station,
  status: RunStatus,
  wallSeconds: number,
  toolCalls: number,
  failureReason: string | null = null,
  pr: number | null = null,
): RunRecord {
  return {
    id,
    workItemId,
    station,
    status,
    startedAt: `2026-06-28T0${(workItemId % 6) + 1}:00:00.000Z`,
    endedAt: status === 'running' ? null : `2026-06-28T0${(workItemId % 6) + 1}:10:00.000Z`,
    failureReason,
    usage: {
      tokensIn: status === 'running' ? null : wallSeconds * 90,
      tokensOut: status === 'running' ? null : wallSeconds * 40,
      wallSeconds,
      toolCalls,
    },
    pr,
  };
}

const RUNS: readonly RunRecord[] = [
  run('01J0A', 41, 'intake', 'success', 38, 12),
  run('01J0B', 41, 'spec', 'success', 96, 41),
  run('01J0C', 41, 'plan', 'success', 140, 88),
  run('01J0D', 41, 'implement', 'success', 760, 240, null, 118),
  run('01J0E', 41, 'qa', 'success', 150, 96, null, 118),
  run('01J0F', 41, 'integrate', 'success', 22, 8, null, 118),
  run('01J0G', 42, 'intake', 'success', 41, 14),
  run('01J0H', 42, 'spec', 'success', 88, 37),
  run('01J0I', 42, 'plan', 'success', 132, 79),
  run('01J0J', 42, 'implement', 'failure', 612, 300, 'ci-failed', 119),
  run('01J0K', 42, 'implement', 'running', 410, 180, null, 119),
  run('01J0L', 43, 'intake', 'success', 35, 11),
  run('01J0M', 43, 'spec', 'escalated', 70, 28, 'needs-human'),
  run('01J0N', 44, 'qa', 'escalated', 120, 90, 'review-rejected', 121),
  run('01J0O', 45, 'implement', 'failure', 540, 260, 'budget', 122),
  run('01J0P', 46, 'plan', 'success', 128, 74),
];

const WORK_ITEMS: readonly WorkItem[] = [
  {
    id: 42,
    title: 'Add rate-limit headers to the public API',
    stage: 'implement',
    priority: 'p1',
    url: 'https://github.com/acme/widgets/issues/42',
  },
  {
    id: 43,
    title: 'Spec: dark-mode token contract',
    stage: 'escalated',
    priority: 'p2',
    url: 'https://github.com/acme/widgets/issues/43',
  },
  {
    id: 44,
    title: 'Migrate sessions table to UUID keys',
    stage: 'qa',
    priority: 'p1',
    url: 'https://github.com/acme/widgets/issues/44',
  },
  {
    id: 45,
    title: 'Refactor the billing webhook handler',
    stage: 'escalated',
    priority: 'p0',
    url: 'https://github.com/acme/widgets/issues/45',
  },
  {
    id: 46,
    title: 'Bump eslint to 9 and fix new lint errors',
    stage: 'plan',
    priority: 'p3',
    url: 'https://github.com/acme/widgets/issues/46',
  },
];

const REVIEW_ITEMS: readonly ReviewItem[] = [
  {
    workItemId: 44,
    prNumber: 121,
    title: 'Migrate sessions table to UUID keys',
    url: 'https://github.com/acme/widgets/pull/121',
    reason: 'approval-gate',
    gatedPaths: ['migrations/0007_sessions_uuid.sql'],
  },
  {
    workItemId: 45,
    prNumber: 122,
    title: 'Refactor the billing webhook handler',
    url: 'https://github.com/acme/widgets/pull/122',
    reason: 'escalated',
    gatedPaths: [],
  },
  {
    workItemId: 42,
    prNumber: 119,
    title: 'Add rate-limit headers to the public API',
    url: 'https://github.com/acme/widgets/pull/119',
    reason: 'qa',
    gatedPaths: [],
  },
];

/** A {@link FactorySource} backed entirely by the constants above. */
export class FixtureSource implements FactorySource {
  readonly label = 'demo fixture';
  readonly isFixture = true;

  listRuns(): Promise<RunRecord[]> {
    return Promise.resolve([...RUNS]);
  }

  listWorkItems(): Promise<WorkItem[]> {
    return Promise.resolve([...WORK_ITEMS]);
  }

  listReviewItems(): Promise<ReviewItem[]> {
    return Promise.resolve([...REVIEW_ITEMS]);
  }

  getPolicy(): Promise<PolicySummary> {
    return Promise.resolve(parsePolicy(POLICY_RAW));
  }
}
