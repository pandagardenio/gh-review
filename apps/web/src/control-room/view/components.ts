/**
 * Small CSP-safe building blocks shared across the panes. Everything is built
 * with `el` from @triage/ui — createElement + CSSOM + addEventListener, never
 * innerHTML — so these views could run injected on github.com unchanged.
 */

import { el } from '@triage/ui';

/** A headline metric: big value, small label, optional sub-line. */
export function statCard(label: string, value: string, sub?: string): HTMLElement {
  return el('div', {
    class: 'cr-card',
    children: [
      el('div', { class: 'cr-card__value', text: value }),
      el('div', { class: 'cr-card__label', text: label }),
      ...(sub ? [el('div', { class: 'cr-card__sub', text: sub })] : []),
    ],
  });
}

export type BadgeKind = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/** A small status pill. */
export function badge(text: string, kind: BadgeKind = 'muted'): HTMLElement {
  return el('span', { class: ['cr-badge', `cr-badge--${kind}`], text });
}

/** A titled section wrapper. */
export function section(title: string, ...children: (Node | string)[]): HTMLElement {
  return el('section', {
    class: 'cr-section',
    children: [el('h2', { class: 'cr-section__title', text: title }), ...children],
  });
}

/** An external link that opens in a new tab, safely (`rel=noopener`). */
export function externalLink(text: string, href: string, cls = 'cr-link'): HTMLElement {
  return el('a', {
    class: cls,
    text,
    attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
  });
}

/** A horizontal proportion bar (0..1), used for success rates. */
export function ratioBar(ratio: number, kind: BadgeKind = 'ok'): HTMLElement {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = el('div', { class: ['cr-bar__fill', `cr-bar__fill--${kind}`] });
  fill.style.width = `${Math.round(clamped * 100)}%`;
  return el('div', { class: 'cr-bar', children: [fill] });
}
