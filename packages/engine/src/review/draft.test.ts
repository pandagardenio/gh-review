import { describe, expect, it } from 'vitest';
import type { PullRequestRef } from '../diff/coordinates.js';
import { setComment } from './comments.js';
import {
  createReviewDraft,
  draftKey,
  findStaleDrafts,
  loadDraft,
  type ReviewDraft,
  removeDraft,
  resolveDraftOnOpen,
  saveDraft,
} from './draft.js';
import { InMemoryDraftStorage } from './draft-storage.js';
import { setFileViewed } from './state.js';

const ref = (headSha: string): PullRequestRef => ({
  owner: 'octo',
  repo: 'repo',
  number: 7,
  headSha,
});

const draftWith = (headSha: string, updatedAt: number): ReviewDraft => {
  const base = createReviewDraft(headSha, updatedAt);
  return {
    ...base,
    intent: 'comment',
    viewed: setFileViewed(base.viewed, 'src/a.ts', true),
    comments: setComment(base.comments, { path: 'src/a.ts', line: 3, side: 'RIGHT' }, 'hi'),
  };
};

describe('draftKey', () => {
  it('embeds owner/repo#number@headSha', () => {
    expect(draftKey(ref('abc123'))).toBe('triage:review:octo/repo#7@abc123');
  });
});

describe('draft persistence', () => {
  it('round-trips the full draft (intent, viewed, comments)', async () => {
    const storage = new InMemoryDraftStorage();
    const draft = draftWith('abc123', 1000);
    await saveDraft(storage, ref('abc123'), draft);

    const restored = await loadDraft(storage, ref('abc123'));
    expect(restored).toEqual(draft);
    expect(restored?.intent).toBe('comment');
    expect(restored?.viewed.viewedPaths).toEqual(['src/a.ts']);
    expect(restored?.comments.comments[0].body).toBe('hi');
  });

  it('returns null when no draft exists for the current head', async () => {
    expect(await loadDraft(new InMemoryDraftStorage(), ref('abc123'))).toBeNull();
  });

  it('removes a draft', async () => {
    const storage = new InMemoryDraftStorage();
    await saveDraft(storage, ref('abc123'), draftWith('abc123', 1));
    await removeDraft(storage, ref('abc123'));
    expect(await loadDraft(storage, ref('abc123'))).toBeNull();
  });

  it('ignores a corrupt stored value instead of throwing', async () => {
    const storage = new InMemoryDraftStorage();
    await storage.write(draftKey(ref('abc123')), '{not json');
    expect(await loadDraft(storage, ref('abc123'))).toBeNull();
  });
});

describe('head-SHA change detection', () => {
  it('does not overwrite an old-SHA draft when the head changes (new key)', async () => {
    const storage = new InMemoryDraftStorage();
    await saveDraft(storage, ref('old'), draftWith('old', 1));
    // Opening at a new head has no draft of its own...
    expect(await loadDraft(storage, ref('new'))).toBeNull();
    // ...but the old draft is still intact.
    expect(await loadDraft(storage, ref('old'))).not.toBeNull();
  });

  it('finds stale drafts for the same PR, newest first', async () => {
    const storage = new InMemoryDraftStorage();
    await saveDraft(storage, ref('sha1'), draftWith('sha1', 100));
    await saveDraft(storage, ref('sha2'), draftWith('sha2', 200));
    const stale = await findStaleDrafts(storage, ref('sha3'));
    expect(stale.map((s) => s.draft.headSha)).toEqual(['sha2', 'sha1']);
  });

  it('findStaleDrafts skips the current key, unrelated keys, and corrupt entries', async () => {
    const storage = new InMemoryDraftStorage();
    await storage.write('some-other-app-key', 'x'); // unrelated → skipped
    await saveDraft(storage, ref('cur'), draftWith('cur', 300)); // current SHA → skipped
    await saveDraft(storage, ref('sha1'), draftWith('sha1', 100)); // valid stale
    await storage.write(draftKey(ref('bad')), '{corrupt'); // same-PR but corrupt → skipped
    const stale = await findStaleDrafts(storage, ref('cur'));
    expect(stale.map((s) => s.draft.headSha)).toEqual(['sha1']);
  });

  it('resolveDraftOnOpen restores an exact-SHA draft', async () => {
    const storage = new InMemoryDraftStorage();
    await saveDraft(storage, ref('sha1'), draftWith('sha1', 1));
    expect(await resolveDraftOnOpen(storage, ref('sha1'))).toEqual({
      status: 'restored',
      draft: draftWith('sha1', 1),
    });
  });

  it('resolveDraftOnOpen surfaces a stale draft on a head change (never silent)', async () => {
    const storage = new InMemoryDraftStorage();
    await saveDraft(storage, ref('sha1'), draftWith('sha1', 1));
    const resolution = await resolveDraftOnOpen(storage, ref('sha2'));
    expect(resolution.status).toBe('stale');
    if (resolution.status === 'stale') {
      expect(resolution.draft.headSha).toBe('sha1');
      expect(resolution.key).toBe('triage:review:octo/repo#7@sha1');
    }
  });

  it('resolveDraftOnOpen reports none when there is nothing stored', async () => {
    expect(await resolveDraftOnOpen(new InMemoryDraftStorage(), ref('sha1'))).toEqual({
      status: 'none',
    });
  });
});
