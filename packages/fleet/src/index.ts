/**
 * `@triage/fleet` — the provider- and UI-agnostic Control Room core.
 *
 * Hard rule (BL-021 / `fleet-isolation`): nothing reachable from this entry may
 * import a UI module or app code. The fleet core is pure model + contracts +
 * roll-ups; dependencies flow apps → fleet/ui → engine only. See
 * CONTROL-ROOM-CONSTITUTION.md.
 */

export {
  formatCount,
  formatDuration,
  formatPercent,
  formatScore,
} from './cockpit/format.js';
export type {
  FleetRow,
  FleetView,
  RepoReviewPull,
  RepoSession,
  RepoView,
  SessionRow,
  SessionsView,
} from './cockpit/view.js';
export { buildFleetView, buildRepoView, buildSessionsView } from './cockpit/view.js';
export { FixtureFleetSource } from './fixture-source.js';
export type { CachedResponse, ConditionalCache } from './github/cache.js';
export { InMemoryConditionalCache } from './github/cache.js';
export type { GitHubClientOptions, GitHubErrorKind } from './github/client.js';
export { GitHubApiError, GitHubClient } from './github/client.js';
export type { RichReader } from './github/ledger-source.js';
export { LedgerFleetSource } from './github/ledger-source.js';
export type {
  FleetRefresh,
  GitHubFleetSourceOptions,
  RepoLoad,
} from './github/source.js';
export { GitHubFleetSource } from './github/source.js';
export { TieredFleetSource } from './github/tiered-source.js';
export type {
  ComponentKey,
  HarnessGrade,
  HarnessHealth,
  HarnessInput,
  HarnessStatus,
  HarnessTier,
  HealthComponent,
  RepoHarness,
} from './harness/harness-health.js';
export {
  HARNESS_WEIGHTS,
  harnessHealth,
  harnessHealthComponents,
  MIN_COMPONENTS,
  rankByHarnessHealth,
  scoreComponents,
} from './harness/harness-health.js';
export type { SessionActivity, SessionCounts } from './ledger/activity.js';
export { countActivity, DEFAULT_FRESHNESS_MS, sessionActivity } from './ledger/activity.js';
export type { FactoryRun } from './ledger/factory-compat.js';
export { mapFactoryRunToSession } from './ledger/factory-compat.js';
export type { LedgerContents } from './ledger/read.js';
export { parseLedger } from './ledger/read.js';
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
