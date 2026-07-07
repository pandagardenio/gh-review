/**
 * The unit the Control Room aggregates over: a repository, plus which data tiers
 * are available for it. Never a person — the fleet is legible by repo, harness,
 * and agent identity only (CONTROL-ROOM-CONSTITUTION.md principle 1).
 */

/**
 * Data tiers (CONTROL-ROOM-CONSTITUTION.md principle 2 — tiered truth):
 * - `baseline` — derivable from GitHub alone; present for every repo.
 * - `rich` — sessions, spend, and hook-friction from an installed ledger emitter.
 */
export type Tier = 'baseline' | 'rich';

export interface FleetRepo {
  /** Repository owner, e.g. `acme`. */
  readonly owner: string;
  /** Repository name, e.g. `widgets`. */
  readonly name: string;
  /** `owner/name` — the aggregation key used everywhere downstream. */
  readonly slug: string;
  /**
   * Tiers this repo can serve. Always includes `baseline`; includes `rich` only
   * when a `triage/ledger` branch exists. A surface reads this to label a repo's
   * rich-tier numbers as present vs unknown, never to fabricate the missing ones.
   */
  readonly tiers: readonly Tier[];
}

/** True when the repo has an instrumented ledger (session/hook data available). */
export function hasRichTier(repo: FleetRepo): boolean {
  return repo.tiers.includes('rich');
}

/** Compose an `owner/name` slug. */
export function repoSlug(owner: string, name: string): string {
  return `${owner}/${name}`;
}
