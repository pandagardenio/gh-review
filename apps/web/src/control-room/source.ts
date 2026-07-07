/**
 * The Control Room's data boundary.
 *
 * The cockpit never talks to GitHub (or anything else) directly — it reads a
 * {@link FactorySource}. This mirrors the engine's `TokenStore` discipline:
 * one interface, swappable backends. `FixtureSource` serves baked sample data so
 * the app runs with zero config; `GitHubSource` reads a live dark-factory repo
 * (its `factory/ledger` branch, its open issues/PRs, its `.factory/policy.yml`).
 *
 * Types mirror the factory's own contracts so the mapping stays honest:
 * the Run record is `.factory/ledger-schema.md`; stages/priorities/gates are
 * `.factory/policy.yml`.
 */

// The factory Run model (Station, STATION_ORDER, RunStatus, RunUsage, RunRecord) and
// its ledger roll-up now live in `@triage/fleet` (BL-029) so no roll-up arithmetic
// remains under apps/web. Re-exported here so the source implementations and views
// keep importing the factory model from a single boundary module.
import type { RunRecord } from '@triage/fleet';

export type { RunRecord, RunStatus, RunUsage, Station } from '@triage/fleet';
export { STATION_ORDER } from '@triage/fleet';

/** WorkItem stage labels (`stage:*` in policy.yml). */
export type Stage =
  | 'queued'
  | 'intake'
  | 'spec'
  | 'plan'
  | 'implement'
  | 'qa'
  | 'integrate'
  | 'done'
  | 'rejected'
  | 'escalated';

export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

/** A piece of work in flight, derived from its GitHub issue + `stage:*` label. */
export interface WorkItem {
  readonly id: number;
  readonly title: string;
  readonly stage: Stage;
  readonly priority: Priority;
  readonly url: string;
}

/** Why a PR is surfaced in the Review pane — the escalation reason. */
export type ReviewReason = 'qa' | 'escalated' | 'approval-gate' | 'open';

/** A PR awaiting a human's eyes — the hand-off into Triage. */
export interface ReviewItem {
  readonly workItemId: number;
  readonly prNumber: number;
  readonly title: string;
  readonly url: string;
  readonly reason: ReviewReason;
  /** Approval-gate paths the PR touches, when reason is `approval-gate`. */
  readonly gatedPaths: readonly string[];
}

/** An approval gate from policy.yml — a path glob or a label, plus its reviewer. */
export interface ApprovalGate {
  readonly pattern?: string;
  readonly label?: string;
  readonly reviewer: string;
}

/** The slice of `.factory/policy.yml` the Configure pane renders. */
export interface PolicySummary {
  readonly maxConcurrency: number | null;
  readonly perWorkItemMaxTokens: number | null;
  readonly perDayMaxTokens: number | null;
  readonly approvalGates: readonly ApprovalGate[];
  /** The raw file text, shown read-only with an "edit on GitHub" affordance. */
  readonly raw: string;
}

/** What the cockpit reads. Every method is async so a network backend fits. */
export interface FactorySource {
  /** Human label for the active source, e.g. `owner/repo` or `demo fixture`. */
  readonly label: string;
  /** True for baked data, so the UI can show a "demo" banner. */
  readonly isFixture: boolean;
  listRuns(): Promise<RunRecord[]>;
  listWorkItems(): Promise<WorkItem[]>;
  listReviewItems(): Promise<ReviewItem[]>;
  getPolicy(): Promise<PolicySummary>;
}
