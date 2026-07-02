/**
 * `@triage/ui` — CSP-safe DOM construction helpers for injected Triage UI.
 *
 * The engine (`@triage/engine`) must never import from here; the dependency only
 * flows UI → engine, never the reverse.
 */
export { diffAnchorHref, diffAnchorId } from './anchor.js';
export type { CommentableDiff, CommentableDiffOptions } from './commentable-diff.js';
export { createCommentableDiff } from './commentable-diff.js';
export { dependencyRows } from './dependency-rows.js';
export { lazyFileDiff, renderFileDiff } from './diff-view.js';
export type { ElementOptions } from './dom.js';
export { el } from './dom.js';
export type { HeadShaNoticeOptions } from './head-sha-notice.js';
export { createHeadShaNotice } from './head-sha-notice.js';
export type { ImplementationFocusOptions } from './implementation-focus.js';
export { createImplementationFocus } from './implementation-focus.js';
export { LocalStorageDraftStorage } from './local-storage-draft-storage.js';
export type { TriagePanelOptions } from './panel.js';
export { createTriagePanel } from './panel.js';
export type { ReviewFlow, ReviewFlowOptions } from './review-flow.js';
export { createReviewFlow } from './review-flow.js';
export type { TestFileViewOptions } from './test-file-view.js';
export { createTestFileView } from './test-file-view.js';
