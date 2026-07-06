/**
 * Host-agnostic channel entry (BL-015) — the bundle published to the update
 * channel (built by `vite.channel.config.ts`, not part of the extension zip).
 *
 * Unlike `content.ts` it presumes no `chrome.*` API and no GitHub page: the
 * consuming host — a future non-GitHub host whose CSP permits remote code
 * (MVP.md §5.2) — supplies its own {@link TokenStore} and decides where to
 * attach the panel. Because the published bundle is a plain IIFE the host
 * executes, the contract is a single global factory: `globalThis.Triage`.
 *
 * Thin by design: the engine/ui packages hold the tested logic.
 */

import type { TokenStore } from '@triage/engine';
import { createReviewApp } from '@triage/ui';

/** Build version, injected by vite `define` from `public/manifest.json`. */
declare const __CHANNEL_VERSION__: string;

export interface TriageChannelGlobal {
  /** The published build's version (matches the channel manifest). */
  readonly version: string;
  /** Build the review panel; the host attaches the returned element itself. */
  mount(options: { tokens: TokenStore }): HTMLElement;
}

const triage: TriageChannelGlobal = {
  version: __CHANNEL_VERSION__,
  mount({ tokens }) {
    return createReviewApp({ tokens, version: __CHANNEL_VERSION__ });
  },
};

(globalThis as { Triage?: TriageChannelGlobal }).Triage = triage;
