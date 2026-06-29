/**
 * `@triage/engine` — the provider- and UI-agnostic core review engine.
 *
 * Hard rule (BL-001 acceptance): nothing reachable from this entry may import a
 * UI module or a browser-extension API. The engine is pure logic + contracts.
 */

export type {
  AutoApprovalPolicy,
  AutoReviewDecision,
  AutoReviewOutcome,
} from './autoreview/model.js';
export {
  DEFAULT_POLICY,
  evaluateAutoReview,
  parseAutoReviewPolicy,
} from './autoreview/policy.js';
export { categorize } from './categorize/categorize.js';
export type { CategoryId, CategoryRule, FileCategory } from './categorize/model.js';
export {
  CATEGORY_RULES,
  isReviewRequiredCategory,
  REVIEW_REQUIRED_CATEGORIES,
} from './categorize/rules.js';
export type {
  DependencyChange,
  DependencyChangeType,
  DependencyKind,
} from './deps/model.js';
export { parseDependencyChanges } from './deps/parse.js';
export type { ApiPullRequestFile } from './diff/api-files.js';
export { mapApiFiles } from './diff/api-files.js';
export type { PullRequestLocator, PullRequestRef } from './diff/coordinates.js';
export { parsePullRequestUrl } from './diff/coordinates.js';
export type { DiffLoadReason } from './diff/errors.js';
export { DiffLoadError } from './diff/errors.js';
export type { DiffHunk, DiffLine, DiffLineKind } from './diff/hunks.js';
export { parseHunks } from './diff/hunks.js';
export type { LoadDiffOptions } from './diff/loader.js';
export { loadPullRequestDiff } from './diff/loader.js';
export type { DiffFile, FileChangeKind, PullRequestDiff } from './diff/model.js';
export { parseUnifiedDiff } from './diff/unified-diff.js';
export type { ReviewProgress, ReviewState, SectionProgress } from './review/state.js';
export {
  createReviewState,
  isFileViewed,
  overallProgress,
  sectionProgress,
  setFilesViewed,
  setFileViewed,
} from './review/state.js';
export { ENGINE_VERSION, engineSmoke } from './smoke.js';
export type { TestCase, TestCaseKind, TestCaseStatus } from './testcases/parse.js';
export { parseTestCases } from './testcases/parse.js';
export type { TokenStore } from './token-store.js';
export { InMemoryTokenStore } from './token-store.js';
