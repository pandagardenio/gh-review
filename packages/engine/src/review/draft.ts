/**
 * Review draft persistence & recovery (BL-011).
 *
 * The entire in-progress review is one serializable object — overall intent,
 * viewed state (BL-007), draft comments (BL-010), the head SHA it was authored
 * against, and `updatedAt` — persisted under a single key that embeds the head
 * SHA. Local-first, no backend (Constitution principle 6).
 *
 * Because the key embeds `@{headSha}`, a new commit yields a *new* key: the old
 * draft is never overwritten. {@link resolveDraftOnOpen} surfaces that as a
 * `stale` result so the reviewer keeps or discards it — we never silently drop
 * work (principle 5). Remapping onto new commits is out of scope (MVP.md §7).
 */

import type { PullRequestRef } from '../diff/coordinates.js';
import type { CommentDraft } from './comments.js';
import { createCommentDraft } from './comments.js';
import type { DraftStorage } from './draft-storage.js';
import type { ReviewState } from './state.js';
import { createReviewState } from './state.js';

export type ReviewIntent = 'none' | 'approve' | 'request-changes' | 'comment';

/** The full serializable review draft. */
export interface ReviewDraft {
  readonly intent: ReviewIntent;
  readonly viewed: ReviewState;
  readonly comments: CommentDraft;
  /** Head SHA this draft was authored against. */
  readonly headSha: string;
  /** Epoch-ms of the last save — supplied by the caller (keeps this pure). */
  readonly updatedAt: number;
}

const KEY_PREFIX = 'triage:review:';

/** `triage:review:{owner}/{repo}#{number}@{headSha}` (MVP.md §4.4). */
export function draftKey(ref: PullRequestRef): string {
  return `${KEY_PREFIX}${ref.owner}/${ref.repo}#${ref.number}@${ref.headSha}`;
}

/** Prefix shared by every head-SHA variant of a PR's draft. */
function prKeyPrefix(ref: PullRequestRef): string {
  return `${KEY_PREFIX}${ref.owner}/${ref.repo}#${ref.number}@`;
}

export function createReviewDraft(headSha: string, updatedAt: number): ReviewDraft {
  return {
    intent: 'none',
    viewed: createReviewState(),
    comments: createCommentDraft(),
    headSha,
    updatedAt,
  };
}

export async function saveDraft(
  storage: DraftStorage,
  ref: PullRequestRef,
  draft: ReviewDraft,
): Promise<void> {
  await storage.write(draftKey(ref), JSON.stringify(draft));
}

export async function loadDraft(
  storage: DraftStorage,
  ref: PullRequestRef,
): Promise<ReviewDraft | null> {
  return readDraft(storage, draftKey(ref));
}

export async function removeDraft(storage: DraftStorage, ref: PullRequestRef): Promise<void> {
  await storage.remove(draftKey(ref));
}

/** Drafts for the same PR authored against a different head SHA, newest first. */
export async function findStaleDrafts(
  storage: DraftStorage,
  ref: PullRequestRef,
): Promise<{ key: string; draft: ReviewDraft }[]> {
  const prefix = prKeyPrefix(ref);
  const currentKey = draftKey(ref);
  const found: { key: string; draft: ReviewDraft }[] = [];
  for (const key of await storage.keys()) {
    if (!key.startsWith(prefix) || key === currentKey) continue;
    const draft = await readDraft(storage, key);
    if (draft) found.push({ key, draft });
  }
  return found.sort((a, b) => b.draft.updatedAt - a.draft.updatedAt);
}

/** What to do when a PR is opened: restore, prompt about a stale draft, or nothing. */
export type DraftResolution =
  | { readonly status: 'none' }
  | { readonly status: 'restored'; readonly draft: ReviewDraft }
  | { readonly status: 'stale'; readonly draft: ReviewDraft; readonly key: string };

export async function resolveDraftOnOpen(
  storage: DraftStorage,
  ref: PullRequestRef,
): Promise<DraftResolution> {
  const current = await loadDraft(storage, ref);
  if (current) return { status: 'restored', draft: current };

  const [stale] = await findStaleDrafts(storage, ref);
  if (stale) return { status: 'stale', draft: stale.draft, key: stale.key };

  return { status: 'none' };
}

async function readDraft(storage: DraftStorage, key: string): Promise<ReviewDraft | null> {
  const raw = await storage.read(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as ReviewDraft;
  } catch {
    return null; // corrupt entry — treat as absent rather than throw
  }
}
