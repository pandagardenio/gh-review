import { describe, expect, it } from 'vitest';
import { LocalStorageTokenStore } from './local-storage-token-store.js';

class FakeStorage implements Storage {
  #m = new Map<string, string>();
  get length() {
    return this.#m.size;
  }
  clear() {
    this.#m.clear();
  }
  getItem(k: string) {
    return this.#m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.#m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.#m.delete(k);
  }
  setItem(k: string, v: string) {
    this.#m.set(k, v);
  }
}

describe('LocalStorageTokenStore', () => {
  it('round-trips set then get', async () => {
    const store = new LocalStorageTokenStore({ storage: new FakeStorage() });
    expect(await store.get()).toBeNull();
    await store.set('ghp_example');
    expect(await store.get()).toBe('ghp_example');
  });

  it('clears the stored token', async () => {
    const store = new LocalStorageTokenStore({ storage: new FakeStorage() });
    await store.set('t');
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  it('honours a custom key', async () => {
    const backing = new FakeStorage();
    await new LocalStorageTokenStore({ storage: backing, key: 'custom' }).set('t');
    expect(backing.getItem('custom')).toBe('t');
  });
});
