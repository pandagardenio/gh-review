/**
 * Observe pane — the floor of the factory at a glance: spend, throughput,
 * per-station health, and the failure clusters. Built from a {@link LedgerSummary}
 * (ledger arithmetic) plus the in-flight {@link WorkItem}s.
 */

import {
  formatCount,
  formatDuration,
  formatPercent,
  type LedgerSummary,
  type StationStat,
} from '@triage/fleet';
import { el } from '@triage/ui';
import type { Stage, WorkItem } from '../source.js';
import { type BadgeKind, badge, ratioBar, section, statCard } from './components.js';

const PIPELINE: readonly Stage[] = [
  'queued',
  'intake',
  'spec',
  'plan',
  'implement',
  'qa',
  'integrate',
];

function rateKind(rate: number): BadgeKind {
  if (rate >= 0.8) return 'ok';
  if (rate >= 0.5) return 'warn';
  return 'danger';
}

function pipelineRow(workItems: readonly WorkItem[]): HTMLElement {
  const escalated = workItems.filter((w) => w.stage === 'escalated').length;
  const cells = PIPELINE.map((stage) => {
    const count = workItems.filter((w) => w.stage === stage).length;
    return el('div', {
      class: ['cr-stage', count > 0 ? 'cr-stage--active' : 'cr-stage--empty'],
      children: [
        el('div', { class: 'cr-stage__count', text: String(count) }),
        el('div', { class: 'cr-stage__name', text: stage }),
      ],
    });
  });
  const children = [...cells];
  if (escalated > 0) {
    children.push(
      el('div', {
        class: ['cr-stage', 'cr-stage--escalated'],
        children: [
          el('div', { class: 'cr-stage__count', text: String(escalated) }),
          el('div', { class: 'cr-stage__name', text: 'escalated' }),
        ],
      }),
    );
  }
  return el('div', { class: 'cr-pipeline', children });
}

function stationRow(s: StationStat): HTMLElement {
  return el('div', {
    class: 'cr-srow',
    children: [
      el('div', { class: 'cr-srow__name', text: s.station }),
      el('div', { class: 'cr-srow__runs', text: `${s.runs} runs` }),
      el('div', {
        class: 'cr-srow__bar',
        children: [ratioBar(s.successRate, rateKind(s.successRate))],
      }),
      badge(formatPercent(s.successRate), rateKind(s.successRate)),
      el('div', {
        class: 'cr-srow__lat',
        text: `p50 ${formatDuration(s.p50Seconds)} · p95 ${formatDuration(s.p95Seconds)}`,
      }),
    ],
  });
}

function failureRow(reason: string, count: number, stations: readonly string[]): HTMLElement {
  return el('div', {
    class: 'cr-frow',
    children: [
      badge(String(count), 'danger'),
      el('div', { class: 'cr-frow__reason', text: reason }),
      el('div', { class: 'cr-frow__where', text: stations.join(', ') }),
    ],
  });
}

/** Render the Observe pane. */
export function observePane(summary: LedgerSummary, workItems: readonly WorkItem[]): HTMLElement {
  const cards = el('div', {
    class: 'cr-cards',
    children: [
      statCard('runs', formatCount(summary.totalRuns), `${summary.byStatus.running} running`),
      statCard('success rate', formatPercent(summary.successRate)),
      statCard('tokens', formatCount(summary.tokens)),
      statCard('tool calls', formatCount(summary.toolCalls)),
      statCard('wall time', formatDuration(summary.wallSeconds)),
    ],
  });

  const stationRows =
    summary.stations.length > 0
      ? summary.stations.map(stationRow)
      : [el('p', { class: 'cr-empty', text: 'No station Runs yet.' })];

  const failureRows =
    summary.failures.length > 0
      ? summary.failures.map((f) => failureRow(f.reason, f.count, f.stations))
      : [el('p', { class: 'cr-empty', text: 'No failures or escalations in window. 🎉' })];

  return el('div', {
    children: [
      cards,
      section('In flight', pipelineRow(workItems)),
      section('Stations', el('div', { class: 'cr-stations', children: stationRows })),
      section('Failure clusters', el('div', { class: 'cr-failures', children: failureRows })),
    ],
  });
}
