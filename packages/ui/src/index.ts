/**
 * `@triage/ui` — CSP-safe DOM construction helpers for injected Triage UI.
 *
 * The engine (`@triage/engine`) must never import from here; the dependency only
 * flows UI → engine, never the reverse.
 */
export { diffAnchorHref, diffAnchorId } from './anchor.js';
export { dependencyRows } from './dependency-rows.js';
export { lazyFileDiff, renderFileDiff } from './diff-view.js';
export type { ElementOptions } from './dom.js';
export { el } from './dom.js';
export type { TriagePanelOptions } from './panel.js';
export { createTriagePanel } from './panel.js';
export type { ReviewFlow, ReviewFlowOptions } from './review-flow.js';
export { createReviewFlow } from './review-flow.js';
