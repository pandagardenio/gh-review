/**
 * Commentable diff (BL-010): the rendered diff (BL-006) with inline draft
 * comments attached to specific lines. Each line resolves to a GitHub review
 * anchor — `RIGHT` + new-file line for added/context rows, `LEFT` + old-file
 * line for removed rows — so the draft matches exactly what BL-012 will POST
 * (MVP.md §7). Add / edit / remove before submission; single-line only (§2).
 *
 * Serves Constitution principle 3 (augment via GitHub's comment primitive) and
 * principle 4 (the reviewer authors; the tool never judges). CSP-safe ({@link el}).
 */

import type { CommentAnchor, CommentDraft, DiffFile } from '@triage/engine';
import { createCommentDraft, getComment, removeComment, setComment } from '@triage/engine';
import { renderFileDiff } from './diff-view.js';
import { el } from './dom.js';

export interface CommentableDiffOptions {
  /** Restore existing comments (BL-011). */
  draft?: CommentDraft;
  /** Notified after every add/edit/remove with the new draft (BL-011 persists). */
  onChange?: (draft: CommentDraft) => void;
}

export interface CommentableDiff {
  readonly element: HTMLElement;
  /** Current serializable comment draft. */
  getDraft(): CommentDraft;
}

/** Render `file`'s diff with per-line commenting wired to a draft. */
export async function createCommentableDiff(
  file: DiffFile,
  options: CommentableDiffOptions = {},
): Promise<CommentableDiff> {
  let draft = options.draft ?? createCommentDraft();
  const element = await renderFileDiff(file);

  const commit = (next: CommentDraft): void => {
    draft = next;
    options.onChange?.(draft);
  };

  for (const row of element.querySelectorAll<HTMLElement>('.triage-diff__row')) {
    const anchor = anchorFor(file.path, row);
    if (anchor) wireRow(row, anchor, () => draft, commit);
  }

  return { element, getDraft: () => draft };
}

/** Resolve a row's comment anchor, or `null` for an uncommentable row. */
function anchorFor(path: string, row: HTMLElement): CommentAnchor | null {
  const oldLine = row.dataset.oldLine ?? '';
  const newLine = row.dataset.newLine ?? '';
  if (row.classList.contains('triage-diff__row--remove')) {
    return oldLine ? { path, line: Number(oldLine), side: 'LEFT' } : null;
  }
  return newLine ? { path, line: Number(newLine), side: 'RIGHT' } : null;
}

function wireRow(
  row: HTMLElement,
  anchor: CommentAnchor,
  getDraft: () => CommentDraft,
  commit: (next: CommentDraft) => void,
): void {
  const slot = el('div', { class: 'triage-comment-slot' });
  row.after(slot);
  let editing = false;

  const render = (): void => {
    slot.replaceChildren();
    const existing = getComment(getDraft(), anchor);

    if (editing) {
      slot.append(
        editor(existing?.body ?? '', anchor, getDraft, commit, () => {
          editing = false;
          render();
        }),
      );
      return;
    }
    if (existing) {
      slot.append(
        commentView(
          existing.body,
          () => {
            editing = true;
            render();
          },
          () => {
            commit(removeComment(getDraft(), anchor));
            render();
          },
        ),
      );
      return;
    }
    slot.append(
      el('button', {
        class: 'triage-comment__add',
        attrs: { type: 'button' },
        text: 'Add comment',
        on: {
          click: () => {
            editing = true;
            render();
          },
        },
      }),
    );
  };

  render();
}

function commentView(body: string, onEdit: () => void, onRemove: () => void): HTMLElement {
  return el('div', {
    class: 'triage-comment',
    children: [
      el('p', { class: 'triage-comment__body', text: body }),
      el('button', {
        class: 'triage-comment__edit',
        attrs: { type: 'button' },
        text: 'Edit',
        on: { click: onEdit },
      }),
      el('button', {
        class: 'triage-comment__remove',
        attrs: { type: 'button' },
        text: 'Remove',
        on: { click: onRemove },
      }),
    ],
  });
}

function editor(
  initial: string,
  anchor: CommentAnchor,
  getDraft: () => CommentDraft,
  commit: (next: CommentDraft) => void,
  done: () => void,
): HTMLElement {
  const textarea = el('textarea', { class: 'triage-comment__input' });
  textarea.value = initial;
  return el('div', {
    class: 'triage-comment__editor',
    children: [
      textarea,
      el('button', {
        class: 'triage-comment__save',
        attrs: { type: 'button' },
        text: 'Save',
        on: {
          click: () => {
            commit(setComment(getDraft(), anchor, textarea.value));
            done();
          },
        },
      }),
      el('button', {
        class: 'triage-comment__cancel',
        attrs: { type: 'button' },
        text: 'Cancel',
        on: { click: done },
      }),
    ],
  });
}
