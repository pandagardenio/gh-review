/**
 * "Finish review" control (BL-012): the reviewer chooses APPROVE / REQUEST_CHANGES
 * / COMMENT, optionally writes an overall body, and submits the accumulated draft
 * as one GitHub review.
 *
 * The reviewer always picks the event — nothing is preselected and nothing
 * auto-approves (Constitution principle 4); the verdict lands in GitHub, not us
 * (principle 3). On success the host clears the draft (`onSubmitted`); on failure
 * the draft is untouched and the error is shown plainly (lose nothing). CSP-safe.
 */

import type {
  DraftComment,
  PullRequestRef,
  ReviewEvent,
  SubmittedReview,
  TokenStore,
} from '@triage/engine';
import { ReviewSubmitError, submitReview } from '@triage/engine';
import { el } from './dom.js';

export interface FinishReviewOptions {
  tokens: TokenStore;
  fetch?: typeof globalThis.fetch;
  /** Current draft comments to materialize. */
  getComments: () => readonly DraftComment[];
  /** Called once the review is submitted so the host can clear the draft. */
  onSubmitted: (review: SubmittedReview) => void;
}

const EVENTS: { value: ReviewEvent; label: string }[] = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REQUEST_CHANGES', label: 'Request changes' },
  { value: 'COMMENT', label: 'Comment' },
];

export function createFinishReview(ref: PullRequestRef, options: FinishReviewOptions): HTMLElement {
  const status = el('p', { class: 'triage-finish__status', attrs: { role: 'status' } });
  const body = el('textarea', { class: 'triage-finish__body' });

  const radios = EVENTS.map(({ value, label }) => {
    const input = el('input', {
      class: 'triage-finish__event',
      attrs: { type: 'radio', name: 'triage-finish-event', value },
    });
    return { value, element: el('label', { children: [input, ` ${label}`] }), input };
  });

  const selectedEvent = (): ReviewEvent | null =>
    radios.find((r) => r.input.checked)?.value ?? null;

  const submit = el('button', {
    class: 'triage-finish__submit',
    attrs: { type: 'button' },
    text: 'Finish review',
    on: {
      click: async () => {
        const event = selectedEvent();
        if (!event) {
          status.textContent = 'Choose approve, request changes, or comment first.';
          return;
        }
        submit.disabled = true;
        status.textContent = 'Submitting…';
        try {
          const review = await submitReview(
            ref,
            { event, body: body.value, comments: options.getComments() },
            { tokens: options.tokens, fetch: options.fetch },
          );
          options.onSubmitted(review);
          renderSubmitted(status, review);
        } catch (error) {
          submit.disabled = false;
          status.replaceChildren(errorText(error));
        }
      },
    },
  });

  return el('section', {
    class: 'triage-finish',
    attrs: { 'aria-label': 'Finish review' },
    children: [
      el('fieldset', {
        class: 'triage-finish__events',
        children: [el('legend', { text: 'Verdict' }), ...radios.map((r) => r.element)],
      }),
      body,
      submit,
      status,
    ],
  });
}

function renderSubmitted(status: HTMLElement, review: SubmittedReview): void {
  status.replaceChildren(
    document.createTextNode('Review submitted. '),
    el('a', {
      class: 'triage-finish__link',
      attrs: { href: review.htmlUrl, target: '_blank', rel: 'noreferrer' },
      text: 'View on GitHub',
    }),
  );
}

function errorText(error: unknown): Text {
  const reason = error instanceof ReviewSubmitError ? error.reason : 'unknown';
  return document.createTextNode(
    `Submission failed (${reason}). Your draft is safe — nothing was lost.`,
  );
}
