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
export type {
  AgentIdentityConfig,
  AgentSignal,
  Provenance,
  ProvenanceClass,
} from './provenance/agent-identity.js';
export {
  classifyCommit,
  classifyPull,
  coAuthorTrailers,
  DEFAULT_AGENT_IDENTITY,
} from './provenance/agent-identity.js';
export type {
  CheckFailureCluster,
  CiHealth,
  CiHealthStat,
} from './provenance/ci-health.js';
export { ciHealth, ciHealthByRepo, MIN_PRS_FOR_RATE } from './provenance/ci-health.js';
export type { CiHealthTrendPoint } from './provenance/ci-trend.js';
export { ciHealthTrend } from './provenance/ci-trend.js';
export type { AgentProvenance, ProvenanceShare, ProvenanceWindow } from './provenance/share.js';
export {
  eachBucketWindow,
  inWindow,
  provenanceByRepo,
  provenanceShare,
  windowEndingAt,
} from './provenance/share.js';
export type { ProvenanceTrendPoint, TrendBucket } from './provenance/trend.js';
export { provenanceTrend } from './provenance/trend.js';
export { FLEET_VERSION, fleetSmoke } from './smoke.js';
export type { FleetSource } from './source.js';
