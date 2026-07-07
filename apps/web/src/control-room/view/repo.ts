/**
 * Repo view (BL-032) — the middle drill level between the fleet grid and the
 * factory cockpit. Reads `@triage/fleet`'s `buildRepoView` (the exact view-model
 * the CLI's `triage repo` renders, so terminal and web never drift): the
 * score-component breakdown, agent CI failure + top failing checks, provenance
 * trend, sessions, and the PRs awaiting review. Works for *any* repo — the factory
 * is offered as a deeper level only when the repo is instrumented (rich tier).
 *
 * CSP-safe (the `el` helper), zero arithmetic in the shell.
 */

import { buildRepoView, formatPercent, formatScore, type RepoView } from '@triage/fleet';
import { el } from '@triage/ui';
import type { WebFleetContext } from '../fleet-source.js';
import { type BadgeKind, badge, externalLink, ratioBar, section, statCard } from './components.js';

function scoreKind(score: number | null): BadgeKind {
  if (score === null) return 'muted';
  if (score < 0.5) return 'danger';
  if (score < 0.75) return 'warn';
  return 'ok';
}

function header(repo: string, isDemo: boolean, isFactory: boolean, on: RepoHandlers): HTMLElement {
  const right: (Node | string)[] = [isDemo ? badge('demo data', 'warn') : badge('live', 'ok')];
  if (isFactory) {
    right.push(
      el('button', {
        class: ['cr-link', 'cr-repo__factory'],
        text: 'Factory →',
        attrs: { type: 'button' },
        on: { click: () => on.factory() },
      }),
    );
  }
  return el('header', {
    class: 'cr-header',
    children: [
      el('button', {
        class: ['cr-brand', 'cr-repo__back'],
        attrs: { type: 'button' },
        on: { click: () => on.back() },
        children: [
          el('span', { class: 'cr-brand__mark', text: '‹' }),
          el('span', { class: 'cr-brand__name', text: `Fleet / ${repo}` }),
        ],
      }),
      el('div', { class: 'cr-header__right', children: right }),
    ],
  });
}

function componentRow(c: RepoView['health']['components'][number]): HTMLElement {
  const value = c.available && c.health !== null ? formatPercent(c.health) : '—';
  const kind: BadgeKind = c.available ? scoreKind(c.health) : 'muted';
  return el('div', {
    class: 'cr-srow',
    children: [
      el('div', { class: 'cr-srow__name', text: c.key }),
      el('div', { class: 'cr-srow__bar', children: [ratioBar(c.health ?? 0, kind)] }),
      badge(value, kind),
      el('div', { class: 'cr-srow__lat', text: c.detail }),
    ],
  });
}

function sessionRow(s: RepoView['sessions'][number]): HTMLElement {
  const kind: BadgeKind =
    s.activity === 'active' ? 'ok' : s.activity === 'stale' ? 'warn' : 'muted';
  const target = s.pr !== null ? `#${s.pr}` : (s.branch ?? '—');
  return el('div', {
    class: 'cr-frow',
    children: [
      badge(s.activity, kind),
      el('div', { class: 'cr-frow__reason', text: `${s.agent} · ${s.status}` }),
      el('div', { class: 'cr-frow__where', text: target }),
    ],
  });
}

function healthSection(view: RepoView): HTMLElement {
  const cards = el('div', {
    class: 'cr-cards',
    children: [
      statCard('harness health', formatScore(view.health.score), view.health.status),
      statCard('grade', view.health.grade ?? '—'),
      statCard('agent CI failure', formatPercent(view.agentCiFailureRate)),
    ],
  });
  const components =
    view.health.components.length > 0
      ? view.health.components.map(componentRow)
      : [el('p', { class: 'cr-empty', text: 'No score components available for this repo.' })];
  return el('div', {
    children: [
      cards,
      section('Score components', el('div', { class: 'cr-stations', children: components })),
    ],
  });
}

function checksSection(view: RepoView): HTMLElement | null {
  if (view.failuresByCheck.length === 0) return null;
  const rows = view.failuresByCheck.map((f) =>
    el('div', {
      class: 'cr-frow',
      children: [
        badge(String(f.failures), 'danger'),
        el('div', { class: 'cr-frow__reason', text: f.name }),
      ],
    }),
  );
  return section('Top failing checks', el('div', { class: 'cr-failures', children: rows }));
}

function sessionsSection(view: RepoView): HTMLElement {
  const body =
    view.sessions.length > 0
      ? view.sessions.map(sessionRow)
      : [el('p', { class: 'cr-empty', text: 'No sessions — baseline tier or none in window.' })];
  return section('Sessions', el('div', { class: 'cr-failures', children: body }));
}

function reviewSection(view: RepoView): HTMLElement {
  const body =
    view.reviewPulls.length > 0
      ? view.reviewPulls.map((p) =>
          el('div', {
            class: 'cr-review',
            children: [
              el('div', {
                class: 'cr-review__head',
                children: [el('span', { class: 'cr-review__num', text: `#${p.number}` })],
              }),
              el('div', { class: 'cr-review__title', text: p.title }),
              p.url
                ? externalLink('Review on GitHub →', p.url, 'cr-review__cta')
                : el('span', {
                    class: ['cr-review__cta', 'cr-review__cta--missing'],
                    text: 'No PR link',
                  }),
            ],
          }),
        )
      : [el('p', { class: 'cr-empty', text: 'Nothing waiting on a human.' })];
  return section('PRs awaiting review', el('div', { class: 'cr-reviews', children: body }));
}

interface RepoHandlers {
  readonly factory: () => void;
  readonly back: () => void;
}

/** Build the repo view DOM (pure). */
export function buildRepoPage(
  view: RepoView,
  isDemo: boolean,
  isFactory: boolean,
  on: RepoHandlers,
): HTMLElement {
  if (!view.ok) {
    return el('div', {
      class: 'cr-app',
      children: [
        header(view.repo, isDemo, false, on),
        el('div', {
          class: ['cr-app', 'cr-app--error'],
          children: [
            el('p', { class: 'cr-center', text: `Could not read ${view.repo}: ${view.error}` }),
          ],
        }),
      ],
    });
  }
  const panes: (Node | string)[] = [healthSection(view)];
  const checks = checksSection(view);
  if (checks) panes.push(checks);
  panes.push(sessionsSection(view), reviewSection(view));
  return el('div', {
    class: 'cr-app',
    children: [
      header(view.repo, isDemo, isFactory, on),
      el('div', { class: 'cr-pane', children: panes }),
    ],
  });
}

/**
 * Rich-tier (instrumented) iff the repo has a readable session ledger — the same
 * `listSessions === null ⇒ baseline` signal the fleet grid uses, so the tier is
 * accurate in live mode too (a live `FleetRepo` from the baseline REST source is
 * always tagged `baseline`, so `hasRichTier` would be wrong here). Best-effort: a
 * failed probe just withholds the deeper level, never a dead-end.
 */
async function isInstrumented(ctx: WebFleetContext, repo: string): Promise<boolean> {
  try {
    return (await ctx.source.listSessions(repo)) !== null;
  } catch {
    return false;
  }
}

/** Mount the repo view into `root`: load the view-model, derive the tier, render. */
export async function mountRepo(
  root: HTMLElement,
  ctx: WebFleetContext,
  repo: string,
  nowMs: number,
  on: RepoHandlers,
): Promise<void> {
  root.replaceChildren(
    el('div', {
      class: ['cr-app', 'cr-app--loading'],
      children: [el('p', { class: 'cr-center', text: `Reading ${repo}…` })],
    }),
  );
  // buildRepoView never throws — it returns `{ ok: false }` on failure, which still
  // renders through buildRepoPage *with* a working back button (never a dead-end).
  const view = await buildRepoView(ctx.source, repo, ctx.window, nowMs);
  const isFactory = view.ok && (await isInstrumented(ctx, repo));
  root.replaceChildren(buildRepoPage(view, ctx.isDemo, isFactory, on));
}
