/**
 * The dark-factory Run model — promoted from the web prototype (BL-029) so the
 * factory ledger arithmetic lives in the provider-agnostic core alongside its
 * roll-up ({@link ./ledger.js}) and the session compat mapping ({@link
 * ../ledger/factory-compat.js}). Pure types + a canonical ordering; no DOM, no
 * app imports — the same isolation discipline as the rest of `@triage/fleet`.
 *
 * A Run is one station invocation against a WorkItem (the factory's
 * `.factory/ledger-schema.md`). It shares the session status and usage shapes,
 * so a Run maps cleanly onto a {@link SessionRecord}.
 */

import type { SessionStatus, SessionUsage } from '../model/session.js';

/** Workstations a Run can belong to (factory architecture §1.2). */
export type Station = 'intake' | 'spec' | 'plan' | 'implement' | 'qa' | 'integrate' | 'deploy';

/** Canonical pipeline order — used to lay stations out left-to-right. */
export const STATION_ORDER: readonly Station[] = [
  'intake',
  'spec',
  'plan',
  'implement',
  'qa',
  'integrate',
  'deploy',
];

/** Run lifecycle — identical vocabulary to a session's; `running` is non-terminal. */
export type RunStatus = SessionStatus;

/** Per-Run resource usage — the same best-effort shape a session carries. */
export type RunUsage = SessionUsage;

/** One station invocation against a WorkItem (ledger-schema.md "Document"). */
export interface RunRecord {
  readonly id: string;
  readonly workItemId: number;
  readonly station: Station;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly endedAt: string | null;
  /** Short controlled vocab when status !== success; null otherwise. */
  readonly failureReason: string | null;
  readonly usage: RunUsage;
  readonly pr: number | null;
}
