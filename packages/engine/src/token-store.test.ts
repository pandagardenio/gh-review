import { describe, expect, it } from 'vitest';
import { InMemoryTokenStore } from './token-store.js';

describe('InMemoryTokenStore', () => {
  it('starts empty by default', async () => {
    const store = new InMemoryTokenStore();
    expect(await store.get()).toBeNull();
  });

  it('honours an initial token', async () => {
    const store = new InMemoryTokenStore('seed');
    expect(await store.get()).toBe('seed');
  });

  it('round-trips set then get', async () => {
    const store = new InMemoryTokenStore();
    await store.set('ghp_example');
    expect(await store.get()).toBe('ghp_example');
  });

  it('clears a stored token', async () => {
    const store = new InMemoryTokenStore('seed');
    await store.clear();
    expect(await store.get()).toBeNull();
  });
});
