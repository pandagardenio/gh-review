import { describe, expect, it } from 'vitest';
import {
  type CommentAnchor,
  commentsForPath,
  createCommentDraft,
  getComment,
  removeComment,
  setComment,
} from './comments.js';

const right: CommentAnchor = { path: 'src/a.ts', line: 12, side: 'RIGHT' };
const left: CommentAnchor = { path: 'src/a.ts', line: 8, side: 'LEFT' };

describe('comment draft', () => {
  it('starts empty', () => {
    expect(createCommentDraft().comments).toEqual([]);
  });

  it('adds a comment anchored to path + line + side', () => {
    const draft = setComment(createCommentDraft(), right, 'needs a guard');
    expect(draft.comments).toEqual([
      { path: 'src/a.ts', line: 12, side: 'RIGHT', body: 'needs a guard' },
    ]);
  });

  it('edits in place (upsert by anchor, not a duplicate)', () => {
    let draft = setComment(createCommentDraft(), right, 'first');
    draft = setComment(draft, right, 'second');
    expect(draft.comments).toHaveLength(1);
    expect(getComment(draft, right)?.body).toBe('second');
  });

  it('distinguishes LEFT and RIGHT on the same line number', () => {
    let draft = setComment(
      createCommentDraft(),
      { path: 'src/a.ts', line: 5, side: 'RIGHT' },
      'new side',
    );
    draft = setComment(draft, { path: 'src/a.ts', line: 5, side: 'LEFT' }, 'old side');
    expect(draft.comments).toHaveLength(2);
    expect(getComment(draft, { path: 'src/a.ts', line: 5, side: 'LEFT' })?.body).toBe('old side');
  });

  it('removes a comment', () => {
    let draft = setComment(createCommentDraft(), right, 'x');
    draft = removeComment(draft, right);
    expect(getComment(draft, right)).toBeUndefined();
  });

  it('treats an empty body as a removal', () => {
    let draft = setComment(createCommentDraft(), right, 'x');
    draft = setComment(draft, right, '   ');
    expect(draft.comments).toEqual([]);
  });

  it('lists comments for a path', () => {
    let draft = setComment(createCommentDraft(), right, 'r');
    draft = setComment(draft, left, 'l');
    draft = setComment(draft, { path: 'other.ts', line: 1, side: 'RIGHT' }, 'o');
    expect(
      commentsForPath(draft, 'src/a.ts')
        .map((c) => c.body)
        .sort(),
    ).toEqual(['l', 'r']);
  });

  it('restores and dedupes from a serialized value', () => {
    const draft = createCommentDraft({
      comments: [
        { path: 'src/a.ts', line: 12, side: 'RIGHT', body: 'a' },
        { path: 'src/a.ts', line: 12, side: 'RIGHT', body: 'dup-overwrites' },
      ],
    });
    expect(draft.comments).toHaveLength(1);
    expect(draft.comments[0].body).toBe('dup-overwrites');
  });
});
