/**
 * `@triage/ui` — CSP-safe DOM construction helpers for injected Triage UI.
 *
 * The engine (`@triage/engine`) must never import from here; the dependency only
 * flows UI → engine, never the reverse.
 */
export type { ElementOptions } from './dom.js';
export { el } from './dom.js';
