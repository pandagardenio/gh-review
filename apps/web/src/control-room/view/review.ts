/**
 * Review pane — the escalation hand-off. Every PR the factory can't seal on its
 * own surfaces here with *why* (QA, an approval gate, or an explicit escalation),
 * and a link out to GitHub where the reviewer launches Triage's categorized flow.
 *
 * This is the seam between the two existing projects: the factory decides what a
 * human must look at; Triage is how they look at it. The control room never
 * approves — it only routes attention (Constitution principle 4).
 */

import { el } from '@triage/ui';
import type { ReviewItem, ReviewReason } from '../source.js';
import { type BadgeKind, badge, externalLink, section } from './components.js';

const REASON_LABEL: Record<ReviewReason, string> = {
  'approval-gate': 'approval gate',
  escalated: 'escalated',
  qa: 'in QA',
  open: 'open',
};

const REASON_KIND: Record<ReviewReason, BadgeKind> = {
  'approval-gate': 'danger',
  escalated: 'danger',
  qa: 'warn',
  open: 'info',
};

function reviewRow(item: ReviewItem): HTMLElement {
  const meta: (Node | string)[] = [
    el('span', { class: 'cr-review__num', text: `#${item.prNumber}` }),
    badge(REASON_LABEL[item.reason], REASON_KIND[item.reason]),
  ];
  if (item.gatedPaths.length > 0) {
    meta.push(el('span', { class: 'cr-review__paths', text: item.gatedPaths.join(', ') }));
  }
  return el('div', {
    class: 'cr-review',
    children: [
      el('div', { class: 'cr-review__head', children: meta }),
      el('div', { class: 'cr-review__title', text: item.title }),
      externalLink('Review on GitHub →', item.url, 'cr-review__cta'),
    ],
  });
}

/** Render the Review pane. */
export function reviewPane(items: readonly ReviewItem[]): HTMLElement {
  const intro = el('p', {
    class: 'cr-note',
    text:
      'PRs the factory will not seal on its own. Open one on GitHub and launch ' +
      'Triage to review it by intent — harness, config, CI, deps, tests first.',
  });
  const body =
    items.length > 0
      ? items.map(reviewRow)
      : [el('p', { class: 'cr-empty', text: 'Nothing waiting on a human. The queue is clear.' })];
  return section('Awaiting review', intro, el('div', { class: 'cr-reviews', children: body }));
}
