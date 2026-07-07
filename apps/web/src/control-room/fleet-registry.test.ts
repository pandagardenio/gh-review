import { describe, expect, it } from 'vitest';
import { loadFleetRepos, saveFleetRepos, webTokenStore } from './fleet-registry.js';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('loadFleetRepos', () => {
  it('prefers a ?repos= list, filtering non-slugs', () => {
    const repos = loadFleetRepos('?repos=acme/api, acme/web ,garbage', memoryStorage());
    expect(repos).toEqual(['acme/api', 'acme/web']);
  });

  it('ignores ?repo= for the source list — it is the drill target, not a selector', () => {
    // ?repo= must not flip an empty (demo) registry into a live single-repo read.
    expect(loadFleetRepos('?repo=acme/api', memoryStorage())).toEqual([]);
    // ...but a stored fleet still resolves alongside a ?repo= drill target.
    const storage = memoryStorage({ 'control-room:repos': 'acme/api,acme/web' });
    expect(loadFleetRepos('?repo=acme/api', storage)).toEqual(['acme/api', 'acme/web']);
  });

  it('reads the stored list when no URL override is present', () => {
    const storage = memoryStorage({ 'control-room:repos': 'acme/api,acme/web' });
    expect(loadFleetRepos('', storage)).toEqual(['acme/api', 'acme/web']);
  });

  it('returns empty (→ demo fixtures) with no override and no storage', () => {
    expect(loadFleetRepos('', memoryStorage())).toEqual([]);
  });
});

describe('saveFleetRepos + webTokenStore', () => {
  it('round-trips the repo list through storage', () => {
    const storage = memoryStorage();
    saveFleetRepos(['acme/api', 'acme/web'], storage);
    expect(loadFleetRepos('', storage)).toEqual(['acme/api', 'acme/web']);
  });

  it('reads and clears the token under the shared key, never from a URL', async () => {
    const storage = memoryStorage({ 'control-room:token': 'ghp_secret' });
    const tokens = webTokenStore(storage);
    expect(await tokens.get()).toBe('ghp_secret');
    await tokens.clear();
    expect(await tokens.get()).toBeNull();
  });
});
