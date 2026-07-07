/**
 * Control Room entry + router (BL-029, three levels since BL-032).
 *
 *   - No `?repo=`              → the Fleet page: the whole fleet (health grid +
 *     sessions), read from the tiered {@link FleetSource}. Zero config → demo fixtures.
 *   - `?repo=owner/repo`       → that repo's fleet-native view (score components, CI,
 *     sessions, provenance, review PRs), read from the same fleet source.
 *   - `?repo=…&view=factory`   → the deepest level: the factory Observe/Configure/Review
 *     cockpit, read from the single-repo factory source (live with a token, else fixtures).
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
import { mountRepo } from './control-room/view/repo.js';

const TOKEN_KEY = 'control-room:token';

function chooseFactorySource(repo: string): FactorySource {
  const token = window.localStorage.getItem(TOKEN_KEY);
  const [owner, name] = repo.split('/');
  if (token && owner && name) return new GitHubSource({ owner, repo: name, token });
  return new FixtureSource();
}

/** Set query params and reload — the router re-reads them to pick the level. */
function goto(mutate: (params: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search);
  mutate(params);
  window.location.search = params.toString();
}

function webContext() {
  const repos = loadFleetRepos(window.location.search, window.localStorage);
  return buildWebFleetContext(repos, webTokenStore(window.localStorage), new Date().toISOString());
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;
  const params = new URLSearchParams(window.location.search);
  const repo = params.get('repo');

  // Deepest level: the factory cockpit, reached explicitly from the repo view.
  if (repo?.includes('/') && params.get('view') === 'factory') {
    await mountControlRoom(app, chooseFactorySource(repo), asTab(params.get('tab')));
    return;
  }

  // Middle level: the fleet-native repo view.
  if (repo?.includes('/')) {
    await mountRepo(app, webContext(), repo, Date.now(), {
      factory: () => goto((p) => p.set('view', 'factory')),
      back: () => goto((p) => p.delete('repo')),
    });
    return;
  }

  // Top level: the fleet grid.
  await mountFleet(app, webContext(), Date.now(), (slug) => goto((p) => p.set('repo', slug)));
}

void main();
