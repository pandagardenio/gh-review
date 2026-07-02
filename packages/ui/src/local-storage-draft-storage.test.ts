import type { PullRequestRef } from '@triage/engine';
import { draftKey, loadDraft, resolveDraftOnOpen, saveDraft } from '@triage/engine';
import { describe, expect, it } from 'vitest';
import { LocalStorageDraftStorage } from './local-storage-draft-storage.js';

/** A minimal in-memory Storage implementation (jsdom localStorage stand-in). */
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

const ref = (headSha: string): PullRequestRef => ({ owner: 'o', repo: 'r', number: 1, headSha });
const draft = (headSha: string, updatedAt: number) => ({
  intent: 'comment' as const,
  viewed: { viewedPaths: ['a.ts'] },
  comments: { comments: [] },
  headSha,
  updatedAt,
});

describe('LocalStorageDraftStorage', () => {
  it('persists and restores a draft through the engine helpers', async () => {
    const storage = new LocalStorageDraftStorage(new FakeStorage());
    await saveDraft(storage, ref('sha1'), draft('sha1', 10));
    expect(await loadDraft(storage, ref('sha1'))).toEqual(draft('sha1', 10));
  });

  it('only reports Triage-owned keys, ignoring unrelated page storage', async () => {
    const backing = new FakeStorage();
    backing.setItem('some-other-app', 'x');
    const storage = new LocalStorageDraftStorage(backing);
    await saveDraft(storage, ref('sha1'), draft('sha1', 10));
    expect(await storage.keys()).toEqual([draftKey(ref('sha1'))]);
  });

  it('surfaces a stale draft on a head-SHA change (never silently dropped)', async () => {
    const storage = new LocalStorageDraftStorage(new FakeStorage());
    await saveDraft(storage, ref('old'), draft('old', 10));
    const resolution = await resolveDraftOnOpen(storage, ref('new'));
    expect(resolution.status).toBe('stale');
    if (resolution.status === 'stale') expect(resolution.draft.headSha).toBe('old');
  });
});
