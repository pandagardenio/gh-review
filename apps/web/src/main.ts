/**
 * Control Room entry + router (BL-029).
 *
 *   - No `?repo=` → the Fleet page: the whole fleet (health grid + sessions),
 *     read from the tiered {@link FleetSource}. Zero config renders demo fixtures.
 *   - `?repo=owner/repo` → that repo's cockpit (Observe / Configure / Review),
 *     read from the single-repo factory source (live with a token, else fixtures).
 *
 * Source selection is local-first — GitHub is the system of record, we hold no
 * backend. Set a token once from the console:
 *   localStorage.setItem('control-room:token', 'ghp_…')
 */

import './styles.css';
import { FixtureSource } from './control-room/fixture-source.js';
import { loadFleetRepos, webTokenStore } from './control-room/fleet-registry.js';
import { buildWebFleetContext } from './control-room/fleet-source.js';
import { GitHubSource } from './control-room/github-source.js';
import type { FactorySource } from './control-room/source.js';
import { asTab, mountControlRoom } from './control-room/view/app.js';
import { mountFleet } from './control-room/view/fleet.js';

const TOKEN_KEY = 'control-room:token';

function chooseFactorySource(repo: string): FactorySource {
  const token = window.localStorage.getItem(TOKEN_KEY);
  const [owner, name] = repo.split('/');
  if (token && owner && name) return new GitHubSource({ owner, repo: name, token });
  return new FixtureSource();
}

function navigateToRepo(slug: string): void {
  const params = new URLSearchParams(window.location.search);
  params.set('repo', slug);
  window.location.search = params.toString();
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;
  const params = new URLSearchParams(window.location.search);
  const repo = params.get('repo');

  if (repo?.includes('/')) {
    const tab = asTab(params.get('tab'));
    await mountControlRoom(app, chooseFactorySource(repo), tab);
    return;
  }

  const repos = loadFleetRepos(window.location.search, window.localStorage);
  const ctx = buildWebFleetContext(
    repos,
    webTokenStore(window.localStorage),
    new Date().toISOString(),
  );
  await mountFleet(app, ctx, Date.now(), navigateToRepo);
}

void main();
