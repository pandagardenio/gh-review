/**
 * Fleet page (BL-029) — the new default route: the whole fleet at a glance, the
 * web sibling of `triage fleet`. A health-sorted repo grid (rich and baseline
 * tiers side by side, honestly labelled), the active/stale session count, and a
 * freshness line. Clicking a repo drills into its cockpit.
 *
 * All roll-ups come from `@triage/fleet`'s view-models — this file only lays them
 * out, CSP-safe (the `el` helper), with zero arithmetic of its own.
 */

import {
  buildFleetView,
  buildSessionsView,
  type FleetRow,
  type FleetSource,
  type FleetView,
  formatPercent,
  formatScore,
  type ProvenanceWindow,
  type SessionsView,
} from '@triage/fleet';
import { el } from '@triage/ui';
import type { WebFleetContext } from '../fleet-source.js';
import { type BadgeKind, badge, section } from './components.js';

function scoreKind(score: number | null): BadgeKind {
  if (score === null) return 'muted';
  if (score < 0.5) return 'danger';
  if (score < 0.75) return 'warn';
  return 'ok';
}

function healthCell(row: FleetRow): HTMLElement {
  if (!row.ok) return badge('error', 'danger');
  const label =
    row.status === 'full' ? formatScore(row.score) : `${formatScore(row.score)} · ${row.status}`;
  const children: (Node | string)[] = [badge(label, scoreKind(row.score))];
  if (row.grade) children.push(el('span', { class: 'cr-fleet__grade', text: row.grade }));
  return el('div', { class: 'cr-fleet__health', children });
}

function repoRow(row: FleetRow, onRepo: (slug: string) => void): HTMLElement {
  const name = el('button', {
    class: 'cr-fleet__repo',
    text: row.repo,
    attrs: { type: 'button' },
    on: { click: () => onRepo(row.repo) },
  });
  if (!row.ok) {
    return el('div', {
      class: ['cr-fleet__row', 'cr-fleet__row--error'],
      children: [
        name,
        el('div', { class: 'cr-fleet__cell', children: [healthCell(row)] }),
        el('div', { class: ['cr-fleet__cell', 'cr-fleet__err'], text: row.error ?? 'load failed' }),
      ],
    });
  }
  return el('div', {
    class: 'cr-fleet__row',
    children: [
      name,
      el('div', { class: 'cr-fleet__cell', children: [healthCell(row)] }),
      el('div', { class: 'cr-fleet__cell', text: formatPercent(row.agentPrShare) }),
      el('div', { class: 'cr-fleet__cell', text: formatPercent(row.agentCiFailureRate) }),
      el('div', {
        class: 'cr-fleet__cell',
        // null = baseline tier (no ledger), rendered "—", distinct from 0 active.
        text: row.activeSessions === null ? '—' : String(row.activeSessions),
      }),
    ],
  });
}

function grid(view: FleetView, onRepo: (slug: string) => void): HTMLElement {
  const head = el('div', {
    class: ['cr-fleet__row', 'cr-fleet__row--head'],
    children: ['repo', 'health', 'agent %', 'CI fail', 'active'].map((h) =>
      el('div', { class: 'cr-fleet__cell', text: h }),
    ),
  });
  const rows =
    view.rows.length > 0
      ? view.rows.map((r) => repoRow(r, onRepo))
      : [
          el('p', {
            class: 'cr-empty',
            text: 'No repos configured. Add some with ?repos=owner/a,owner/b.',
          }),
        ];
  return el('div', { class: 'cr-fleet', children: [head, ...rows] });
}

function freshness(view: FleetView, sessions: SessionsView): HTMLElement {
  const time = new Date(view.asOfMs).toISOString().slice(11, 16);
  const active = sessions.rows.filter((r) => r.activity === 'active').length;
  const stale = sessions.rows.filter((r) => r.activity === 'stale').length;
  return el('p', {
    class: 'cr-fleet__foot',
    text: `${view.refreshed}/${view.total} repos fresh · ${active} active · ${stale} stale sessions · as of ${time}`,
  });
}

/** Build the fleet page DOM from the two view-models (pure). */
export function buildFleetPage(
  view: FleetView,
  sessions: SessionsView,
  onRepo: (slug: string) => void,
): HTMLElement {
  return el('div', {
    children: [section('Fleet', grid(view, onRepo)), freshness(view, sessions)],
  });
}

/** Load the two fleet view-models from a source (IO split from rendering). */
export async function loadFleetPage(
  source: FleetSource,
  window: ProvenanceWindow,
  nowMs: number,
): Promise<{ view: FleetView; sessions: SessionsView }> {
  const [view, sessions] = await Promise.all([
    buildFleetView(source, window, nowMs),
    buildSessionsView(source, nowMs),
  ]);
  return { view, sessions };
}

function fleetHeader(isDemo: boolean): HTMLElement {
  return el('header', {
    class: 'cr-header',
    children: [
      el('div', {
        class: 'cr-brand',
        children: [
          el('span', { class: 'cr-brand__mark', text: '◧' }),
          el('span', { class: 'cr-brand__name', text: 'Control Room · Fleet' }),
        ],
      }),
      el('div', {
        class: 'cr-header__right',
        children: [isDemo ? badge('demo data', 'warn') : badge('live', 'ok')],
      }),
    ],
  });
}

/** Mount the fleet page into `root`, managing loading and per-fleet error states. */
export async function mountFleet(
  root: HTMLElement,
  ctx: WebFleetContext,
  nowMs: number,
  onRepo: (slug: string) => void,
): Promise<void> {
  root.replaceChildren(
    el('div', {
      class: ['cr-app', 'cr-app--loading'],
      children: [el('p', { class: 'cr-center', text: 'Reading the fleet…' })],
    }),
  );
  try {
    const { view, sessions } = await loadFleetPage(ctx.source, ctx.window, nowMs);
    root.replaceChildren(
      el('div', {
        class: 'cr-app',
        children: [
          fleetHeader(ctx.isDemo),
          el('div', { class: 'cr-pane', children: [buildFleetPage(view, sessions, onRepo)] }),
        ],
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    root.replaceChildren(
      el('div', {
        class: ['cr-app', 'cr-app--error'],
        children: [el('p', { class: 'cr-center', text: `Could not read the fleet: ${message}` })],
      }),
    );
  }
}
