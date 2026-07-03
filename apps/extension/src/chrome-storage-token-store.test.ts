import { describe, expect, it } from 'vitest';
import { ChromeStorageTokenStore } from './chrome-storage-token-store.js';

/** Minimal in-memory stand-in for a chrome.storage.StorageArea. */
function fakeArea(): chrome.storage.StorageArea {
  const map = new Map<string, unknown>();
  return {
    get: async (key: string) => (map.has(key) ? { [key]: map.get(key) } : {}),
    set: async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) map.set(k, v);
    },
    remove: async (key: string) => {
      map.delete(key);
    },
  } as unknown as chrome.storage.StorageArea;
}

describe('ChromeStorageTokenStore', () => {
  it('round-trips set then get', async () => {
    const store = new ChromeStorageTokenStore(fakeArea());
    expect(await store.get()).toBeNull();
    await store.set('ghp_example');
    expect(await store.get()).toBe('ghp_example');
  });

  it('clears the stored token', async () => {
    const store = new ChromeStorageTokenStore(fakeArea());
    await store.set('t');
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  it('returns null for a non-string stored value', async () => {
    const area = fakeArea();
    await area.set({ 'triage:token': 42 });
    expect(await new ChromeStorageTokenStore(area).get()).toBeNull();
  });
});
