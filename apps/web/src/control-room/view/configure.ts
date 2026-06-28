/**
 * Configure pane — the factory's `.factory/policy.yml`, read here, edited as a
 * PR on GitHub. policy.yml is itself an approval-gate path, so every change is a
 * human-reviewed PR (in Triage) — config travels the same road as code. The
 * cockpit shows highlights + the raw file; it never writes.
 */

import { el } from '@triage/ui';
import { formatCount } from '../format.js';
import type { PolicySummary } from '../source.js';
import { badge, externalLink, section, statCard } from './components.js';

function gateRow(label: string, value: string): HTMLElement {
  return el('div', {
    class: 'cr-gate',
    children: [
      badge('human', 'danger'),
      el('code', { class: 'cr-gate__pat', text: value }),
      el('span', { class: 'cr-gate__kind', text: label }),
    ],
  });
}

/** Render the Configure pane. `editUrl` links to GitHub's editor when live. */
export function configurePane(policy: PolicySummary, editUrl?: string): HTMLElement {
  const cards = el('div', {
    class: 'cr-cards',
    children: [
      statCard(
        'max concurrency',
        policy.maxConcurrency === null ? '—' : String(policy.maxConcurrency),
      ),
      statCard(
        'tokens / WorkItem',
        policy.perWorkItemMaxTokens === null ? '—' : formatCount(policy.perWorkItemMaxTokens),
      ),
      statCard('approval gates', String(policy.approvalGates.length)),
    ],
  });

  const gates = policy.approvalGates.map((g) =>
    gateRow(g.pattern ? 'path' : 'label', g.pattern ?? g.label ?? '?'),
  );
  const gatesBody =
    gates.length > 0
      ? gates
      : [el('p', { class: 'cr-empty', text: 'No approval gates declared.' })];

  const rawHead: (Node | string)[] = [el('h2', { class: 'cr-section__title', text: 'policy.yml' })];
  if (editUrl)
    rawHead.push(externalLink('Propose change on GitHub →', editUrl, 'cr-link cr-link--right'));

  return el('div', {
    children: [
      cards,
      section(
        'Approval gates — always human',
        el('div', { class: 'cr-gates', children: gatesBody }),
      ),
      el('section', {
        class: 'cr-section',
        children: [
          el('div', { class: 'cr-section__head', children: rawHead }),
          el('pre', { class: 'cr-raw', children: [el('code', { text: policy.raw })] }),
        ],
      }),
    ],
  });
}
