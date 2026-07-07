/**
 * Fleet registry for the web cockpit (BL-029). The fleet's repo list lives in
 * `localStorage`, overridable by URL so a link can point the cockpit at a fleet
 * without touching storage:
 *   - `?repos=acme/api,acme/web` → those repos (comma-separated).
 *   - otherwise                 → the stored list, or empty (→ demo fixtures).
 *
 * `?repo=owner/repo` is deliberately NOT a fleet-list selector — it is the *drill
 * target* the router zooms into (BL-032), read against this same fleet source.
 * Treating it as a one-repo list would flip the demo into a live single-repo read
 * the moment you click a fixture row.
 *
 * The token follows the same `TokenStore` discipline as Triage: its *value* lives
 * in `localStorage` under one key, never in a URL. No backend of our own.
 */

const REPOS_KEY = 'control-room:repos';
const TOKEN_KEY = 'control-room:token';
const SLUG = /^[^/\s]+\/[^/\s]+$/;

/** A minimal async token accessor — the shape the fleet sources consume. */
export interface WebTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

function splitRepos(value: string): string[] {
  return value
    .split(',')
    .map((r) => r.trim())
    .filter((r) => SLUG.test(r));
}

/** Resolve the fleet's repo list: `?repos=` override, then storage, then empty. */
export function loadFleetRepos(search: string, storage: Storage): string[] {
  const many = new URLSearchParams(search).get('repos');
  if (many) return splitRepos(many);
  const stored = storage.getItem(REPOS_KEY);
  return stored ? splitRepos(stored) : [];
}

/** Persist a repo list to storage (used by a future settings affordance). */
export function saveFleetRepos(repos: readonly string[], storage: Storage): void {
  storage.setItem(REPOS_KEY, repos.join(','));
}

/** A {@link WebTokenStore} backed by `localStorage` under the shared token key. */
export function webTokenStore(storage: Storage): WebTokenStore {
  return {
    get: async () => storage.getItem(TOKEN_KEY),
    set: async (token: string) => storage.setItem(TOKEN_KEY, token),
    clear: async () => storage.removeItem(TOKEN_KEY),
  };
}
