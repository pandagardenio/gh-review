/**
 * `@triage/engine` — the provider- and UI-agnostic core review engine.
 *
 * Hard rule (BL-001 acceptance): nothing reachable from this entry may import a
 * UI module or a browser-extension API. The engine is pure logic + contracts.
 */

export type { DiffFile, FileChangeKind, PullRequestDiff } from './diff/model.js';
export { ENGINE_VERSION, engineSmoke } from './smoke.js';
export type { TokenStore } from './token-store.js';
export { InMemoryTokenStore } from './token-store.js';
