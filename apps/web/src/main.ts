/**
 * Control Room entry. Picks a data source and mounts the cockpit.
 *
 * Source selection (no backend of our own — GitHub is the system of record):
 *   - `?repo=owner/repo` in the URL + a token in localStorage → live GitHubSource.
 *   - otherwise → FixtureSource, so the app always renders something.
 *
 * Set a token once from the console:
 *   localStorage.setItem('control-room:token', 'ghp_…')
 */

import './styles.css';
import { FixtureSource } from './control-room/fixture-source.js';
import { GitHubSource } from './control-room/github-source.js';
import type { FactorySource } from './control-room/source.js';
import { asTab, mountControlRoom } from './control-room/view/app.js';

const TOKEN_KEY = 'control-room:token';

function chooseSource(): FactorySource {
  const repo = new URLSearchParams(window.location.search).get('repo');
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (repo && token) {
    const [owner, name] = repo.split('/');
    if (owner && name) {
      return new GitHubSource({ owner, repo: name, token });
    }
  }
  return new FixtureSource();
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;
  const tab = asTab(new URLSearchParams(window.location.search).get('tab'));
  await mountControlRoom(app, chooseSource(), tab);
}

void main();
