/**
 * The rich-tier records: coding-agent sessions and hook-friction events, written
 * append-only to a repo's `triage/ledger` branch by the emitter (BL-026) and read
 * back by the ledger source (BL-027).
 *
 * Aggregation-key discipline (CONTROL-ROOM-CONSTITUTION.md principle 1): the only
 * identity a record carries is `agent` — the harness/agent name, e.g. `claude-code`.
 * No login, email, or hostname of a person appears anywhere in these types.
 */

/** Session lifecycle. `running` is the sole non-terminal state. */
export type SessionStatus = 'running' | 'success' | 'failure' | 'escalated';

/** Best-effort resource usage; token fields may be null when the harness omits them. */
export interface SessionUsage {
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  readonly wallSeconds: number;
  readonly toolCalls: number;
}

/**
 * One coding-agent session against a repo. The ledger stores append-only
 * snapshots sharing an `id` (start → heartbeat(s) → end); the reader folds them
 * to the latest per id (BL-027).
 */
export interface SessionRecord {
  /** Stable session id; snapshots share it so the reader folds to the latest. */
  readonly id: string;
  /** `owner/name` the session ran against. */
  readonly repo: string;
  /** Harness/agent identity, e.g. `claude-code`. Never a person. */
  readonly agent: string;
  readonly status: SessionStatus;
  readonly startedAt: string;
  /** Set on the terminal snapshot; null while running. */
  readonly endedAt: string | null;
  /** Last heartbeat; drives active/stale derivation (BL-027). Null if never beat. */
  readonly heartbeatAt: string | null;
  /** Optional pipeline stage tag (a dark-factory station maps here). */
  readonly stage: string | null;
  readonly branch: string | null;
  readonly pr: number | null;
  /** Short controlled vocab when status !== success; null otherwise. */
  readonly failureReason: string | null;
  readonly usage: SessionUsage;
}

/** Outcome of a hook firing — the raw signal behind harness hook-friction (BL-024). */
export type HookOutcome = 'allow' | 'block' | 'warn';

/** A single hook event: which hook fired, on which session, and how it resolved. */
export interface HookEventRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly repo: string;
  /** Hook name, e.g. `PreToolUse`, `Stop`. */
  readonly hook: string;
  /** Forbidden-pattern / rule id that fired, or null when none. */
  readonly ruleId: string | null;
  readonly outcome: HookOutcome;
  readonly at: string;
}
