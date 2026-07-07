/**
 * `@triage/fleet` — the provider- and UI-agnostic Control Room core.
 *
 * Hard rule (BL-021 / `fleet-isolation`): nothing reachable from this entry may
 * import a UI module or app code. The fleet core is pure model + contracts +
 * roll-ups; dependencies flow apps → fleet/ui → engine only. See
 * CONTROL-ROOM-CONSTITUTION.md.
 */

export { FixtureFleetSource } from './fixture-source.js';
export type { LedgerEntry } from './ledger/schema.js';
export {
  LEDGER_SCHEMA_VERSION,
  LedgerParseError,
  parseLedgerLine,
  serializeLedgerLine,
} from './ledger/schema.js';
export type {
  CheckConclusion,
  CheckRecord,
  CommitRecord,
  PullRecord,
  PullState,
  ReviewState,
} from './model/github.js';
export type { FleetRepo, Tier } from './model/repo.js';
export { hasRichTier, repoSlug } from './model/repo.js';
export type {
  HookEventRecord,
  HookOutcome,
  SessionRecord,
  SessionStatus,
  SessionUsage,
} from './model/session.js';
export { FLEET_VERSION, fleetSmoke } from './smoke.js';
export type { FleetSource } from './source.js';
