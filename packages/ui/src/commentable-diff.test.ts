import type { DiffFile } from '@triage/engine';
import { describe, expect, it, vi } from 'vitest';
import { createCommentableDiff } from './commentable-diff.js';

const file = (over: Partial<DiffFile> = {}): DiffFile => ({
  path: 'src/a.ts',
  change: 'modified',
  additions: 1,
  deletions: 1,
  isBinary: false,
  patch: ['@@ -1,2 +1,2 @@', ' const a = 1;', '-const b = 2;', '+const b = 3;'].join('\n'),
  ...over,
});

const rowOf = (root: HTMLElement, kind: string) =>
  root.querySelector(`.triage-diff__row--${kind}`)?.nextElementSibling as HTMLElement;

const click = (root: ParentNode, sel: string) =>
  (root.querySelector(sel) as HTMLButtonElement).click();

describe('createCommentableDiff', () => {
  it('adds a comment on the RIGHT side (added line) with the new-file line', async () => {
    const onChange = vi.fn();
    const { element, getDraft } = await createCommentableDiff(file(), { onChange });
    const slot = rowOf(element, 'add');

    click(slot, '.triage-comment__add');
    (slot.querySelector('.triage-comment__input') as HTMLTextAreaElement).value = 'use a const';
    click(slot, '.triage-comment__save');

    expect(getDraft().comments).toEqual([
      { path: 'src/a.ts', line: 2, side: 'RIGHT', body: 'use a const' },
    ]);
    expect(onChange).toHaveBeenCalled();
    expect(slot.querySelector('.triage-comment__body')?.textContent).toBe('use a const');
  });

  it('anchors a comment on a removed line to the LEFT side with the old-file line', async () => {
    const { element, getDraft } = await createCommentableDiff(file());
    const slot = rowOf(element, 'remove');
    click(slot, '.triage-comment__add');
    (slot.querySelector('.triage-comment__input') as HTMLTextAreaElement).value = 'why removed?';
    click(slot, '.triage-comment__save');
    expect(getDraft().comments).toEqual([
      { path: 'src/a.ts', line: 2, side: 'LEFT', body: 'why removed?' },
    ]);
  });

  it('edits an existing comment in place', async () => {
    const { element, getDraft } = await createCommentableDiff(file());
    const slot = rowOf(element, 'add');
    click(slot, '.triage-comment__add');
    (slot.querySelector('.triage-comment__input') as HTMLTextAreaElement).value = 'first';
    click(slot, '.triage-comment__save');

    click(slot, '.triage-comment__edit');
    const input = slot.querySelector('.triage-comment__input') as HTMLTextAreaElement;
    expect(input.value).toBe('first'); // prefilled
    input.value = 'second';
    click(slot, '.triage-comment__save');

    expect(getDraft().comments).toHaveLength(1);
    expect(getDraft().comments[0].body).toBe('second');
  });

  it('removes a comment', async () => {
    const { element, getDraft } = await createCommentableDiff(file());
    const slot = rowOf(element, 'add');
    click(slot, '.triage-comment__add');
    (slot.querySelector('.triage-comment__input') as HTMLTextAreaElement).value = 'temp';
    click(slot, '.triage-comment__save');
    click(slot, '.triage-comment__remove');
    expect(getDraft().comments).toEqual([]);
    expect(slot.querySelector('.triage-comment__add')).not.toBeNull(); // back to add affordance
  });

  it('cancel discards the editor without adding a comment', async () => {
    const { element, getDraft } = await createCommentableDiff(file());
    const slot = rowOf(element, 'add');
    click(slot, '.triage-comment__add');
    click(slot, '.triage-comment__cancel');
    expect(getDraft().comments).toEqual([]);
    expect(slot.querySelector('.triage-comment__editor')).toBeNull();
  });

  it('restores comments from an initial draft', async () => {
    const { element } = await createCommentableDiff(file(), {
      draft: { comments: [{ path: 'src/a.ts', line: 2, side: 'RIGHT', body: 'restored' }] },
    });
    const slot = rowOf(element, 'add');
    expect(slot.querySelector('.triage-comment__body')?.textContent).toBe('restored');
  });
});
