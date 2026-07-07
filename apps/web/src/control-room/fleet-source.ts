/**
 * Build the web cockpit's live fleet data plane (BL-029) from a repo list. With
 * no repos configured we serve {@link FixtureFleetSource} so the app always
 * renders — the zero-config demo. With repos + a token we compose the tiered
 * source (baseline GitHub REST + rich ledger) behind one shared conditional cache,
 * exactly as the CLI cockpit does, so both cockpits read identical roll-ups.
 */

import {
  FixtureFleetSource,
  type FleetSource,
  GitHubFleetSource,
  InMemoryConditionalCache,
  LedgerFleetSource,
  type ProvenanceWindow,
  TieredFleetSource,
  windowEndingAt,
} from '@triage/fleet';
import type { WebTokenStore } from './fleet-registry.js';

export interface WebFleetContext {
  readonly source: FleetSource;
  readonly window: ProvenanceWindow;
  /** True when serving baked fixtures (no repos configured) — drives the demo banner. */
  readonly isDemo: boolean;
}

const DEFAULT_WINDOW_DAYS = 30;

/** Build the fleet source + metrics window for the web cockpit. */
export function buildWebFleetContext(
  repos: readonly string[],
  tokens: WebTokenStore,
  nowIso: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): WebFleetContext {
  const window = windowEndingAt(nowIso, windowDays);
  if (repos.length === 0) {
    return { source: new FixtureFleetSource(), window, isDemo: true };
  }
  const cache = new InMemoryConditionalCache();
  const baseline = new GitHubFleetSource({ repos: [...repos], tokens, window, cache });
  const rich = new LedgerFleetSource({ tokens, cache });
  return { source: new TieredFleetSource(baseline, rich), window, isDemo: false };
}
