/**
 * The cockpit shell: header, tab bar, and the active pane. Data loading is split
 * from rendering — {@link loadData} gathers a {@link FactorySource} into a plain
 * snapshot, {@link buildView} turns a snapshot into DOM (pure, testable), and
 * {@link mountControlRoom} wires the two together with loading/error states.
 */

import { type LedgerSummary, summarize } from '@triage/fleet';
import { el } from '@triage/ui';
import type { FactorySource, PolicySummary, ReviewItem, WorkItem } from '../source.js';
import { badge, externalLink } from './components.js';
import { configurePane } from './configure.js';
import { observePane } from './observe.js';
import { reviewPane } from './review.js';

export type Tab = 'observe' | 'configure' | 'review';
const TABS: readonly Tab[] = ['observe', 'configure', 'review'];

/** Narrow an arbitrary string to a {@link Tab}, defaulting to `observe`. */
export function asTab(value: string | null): Tab {
  return TABS.includes(value as Tab) ? (value as Tab) : 'observe';
}

export interface ControlRoomData {
  readonly summary: LedgerSummary;
  readonly workItems: readonly WorkItem[];
  readonly reviewItems: readonly ReviewItem[];
  readonly policy: PolicySummary;
}

/** Gather a source into a single immutable snapshot the views render from. */
export async function loadData(source: FactorySource): Promise<ControlRoomData> {
  const [runs, workItems, reviewItems, policy] = await Promise.all([
    source.listRuns(),
    source.listWorkItems(),
    source.listReviewItems(),
    source.getPolicy(),
  ]);
  return { summary: summarize(runs), workItems, reviewItems, policy };
}

function policyEditUrl(source: FactorySource): string | undefined {
  return source.isFixture
    ? undefined
    : `https://github.com/${source.label}/edit/main/.factory/policy.yml`;
}

function header(source: FactorySource): HTMLElement {
  const right: (Node | string)[] = [el('span', { class: 'cr-source', text: source.label })];
  right.push(source.isFixture ? badge('demo data', 'warn') : badge('live', 'ok'));
  return el('header', {
    class: 'cr-header',
    children: [
      el('div', {
        class: 'cr-brand',
        children: [
          el('span', { class: 'cr-brand__mark', text: '◧' }),
          el('span', { class: 'cr-brand__name', text: 'Control Room' }),
        ],
      }),
      el('div', { class: 'cr-header__right', children: right }),
    ],
  });
}

function tabBar(active: Tab, onTab: (tab: Tab) => void): HTMLElement {
  return el('nav', {
    class: 'cr-tabs',
    children: TABS.map((tab) =>
      el('button', {
        class: ['cr-tab', tab === active ? 'cr-tab--active' : 'cr-tab--idle'],
        text: tab,
        attrs: { type: 'button' },
        on: { click: () => onTab(tab) },
      }),
    ),
  });
}

function pane(tab: Tab, data: ControlRoomData, source: FactorySource): HTMLElement {
  if (tab === 'configure') return configurePane(data.policy, policyEditUrl(source));
  if (tab === 'review') return reviewPane(data.reviewItems);
  return observePane(data.summary, data.workItems);
}

/** Build the full cockpit DOM for a loaded snapshot (pure). */
export function buildView(
  data: ControlRoomData,
  source: FactorySource,
  active: Tab,
  onTab: (tab: Tab) => void,
): HTMLElement {
  return el('div', {
    class: 'cr-app',
    children: [
      header(source),
      tabBar(active, onTab),
      el('div', { class: 'cr-pane', children: [pane(active, data, source)] }),
    ],
  });
}

function centered(text: string, cls: string): HTMLElement {
  return el('div', { class: ['cr-app', cls], children: [el('p', { class: 'cr-center', text })] });
}

/** Mount the cockpit into `root`, managing loading, errors, and tab state. */
export async function mountControlRoom(
  root: HTMLElement,
  source: FactorySource,
  initialTab: Tab = 'observe',
): Promise<void> {
  root.replaceChildren(centered('Loading the factory floor…', 'cr-app--loading'));
  let data: ControlRoomData;
  try {
    data = await loadData(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    root.replaceChildren(
      el('div', {
        class: ['cr-app', 'cr-app--error'],
        children: [
          el('p', { class: 'cr-center', text: `Could not read ${source.label}: ${message}` }),
          externalLink('GitHub status', 'https://www.githubstatus.com/', 'cr-link'),
        ],
      }),
    );
    return;
  }

  let active: Tab = initialTab;
  const render = (): void => {
    root.replaceChildren(
      buildView(data, source, active, (tab) => {
        active = tab;
        render();
      }),
    );
  };
  render();
}
