/**
 * Render cockpit view-models to plain ANSI tables (BL-028). Read-only: the only
 * "actions" are printed URLs. Colour is applied only on a TTY (auto-disabled when
 * piped), so `--json`-free output stays clean in CI. All numbers/labels come from
 * the `@triage/fleet` view-models — this file only lays them out.
 */

import {
  type FleetView,
  formatPercent,
  formatScore,
  type RepoView,
  type SessionsView,
} from '@triage/fleet';

export interface RenderOptions {
  readonly color: boolean;
}

const CODES = { dim: 2, red: 31, green: 32, yellow: 33, reset: 0 } as const;

function paint(text: string, code: number, color: boolean): string {
  return color ? `\x1b[${code}m${text}\x1b[${CODES.reset}m` : text;
}

function freshnessLine(asOfMs: number, refreshed: number, total: number, color: boolean): string {
  const time = new Date(asOfMs).toISOString().slice(11, 16);
  return paint(`as of ${time} · ${refreshed}/${total} repos fresh`, CODES.dim, color);
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function row(cells: string[], widths: number[]): string {
  return cells.map((cell, i) => pad(cell, widths[i] ?? 0)).join('  ');
}

export function renderFleet(view: FleetView, options: RenderOptions): string {
  const widths = [24, 7, 8, 9, 8];
  const header = row(['REPO', 'HEALTH', 'AGENT%', 'CI FAIL', 'ACTIVE'], widths);
  const lines = view.rows.map((r) => {
    if (!r.ok)
      return paint(row([r.repo, 'ERR', '—', '—', r.error ?? ''], widths), CODES.red, options.color);
    const grade = `${formatScore(r.score)} ${r.grade ?? '·'}`;
    const label = r.status === 'full' ? grade : `${grade} (${r.status})`;
    const cells = row(
      [
        r.repo,
        label,
        formatPercent(r.agentPrShare),
        formatPercent(r.agentCiFailureRate),
        r.activeSessions === null ? '—' : String(r.activeSessions),
      ],
      widths,
    );
    return gradeColor(cells, r.score, options.color);
  });
  return [
    paint(header, CODES.dim, options.color),
    ...lines,
    '',
    freshnessLine(view.asOfMs, view.refreshed, view.total, options.color),
  ].join('\n');
}

function gradeColor(text: string, score: number | null, color: boolean): string {
  if (score === null) return text;
  if (score < 0.5) return paint(text, CODES.red, color);
  if (score < 0.75) return paint(text, CODES.yellow, color);
  return paint(text, CODES.green, color);
}

export function renderSessions(view: SessionsView, options: RenderOptions): string {
  const widths = [24, 12, 8, 9, 10];
  const header = row(['REPO', 'AGENT', 'STATE', 'AGE(min)', 'PR/BRANCH'], widths);
  const lines = view.rows.map((r) => {
    const state =
      r.activity === 'stale'
        ? paint('stale', CODES.yellow, options.color)
        : paint('active', CODES.green, options.color);
    const target = r.pr !== null ? `#${r.pr}` : (r.branch ?? '—');
    return row([r.repo, r.agent, state, String(Math.round(r.ageSeconds / 60)), target], widths);
  });
  const summary = `${view.rows.filter((r) => r.activity === 'active').length} active · ${view.rows.filter((r) => r.activity === 'stale').length} stale`;
  return [
    paint(header, CODES.dim, options.color),
    ...lines,
    '',
    paint(
      `${summary} · as of ${new Date(view.asOfMs).toISOString().slice(11, 16)}`,
      CODES.dim,
      options.color,
    ),
  ].join('\n');
}

export function renderRepo(view: RepoView, options: RenderOptions): string {
  if (!view.ok) return paint(`${view.repo}: ${view.error}`, CODES.red, options.color);
  const out: string[] = [];
  out.push(paint(view.repo, CODES.green, options.color));
  out.push(
    `  health ${formatScore(view.health.score)} ${view.health.grade ?? '·'} (${view.health.status})`,
  );
  for (const c of view.health.components) {
    const value = c.available ? c.detail : `— ${c.detail}`;
    out.push(`    ${pad(c.key, 18)} ${value}`);
  }
  out.push(`  agent CI failure ${formatPercent(view.agentCiFailureRate)}`);
  if (view.failuresByCheck.length > 0) {
    out.push(
      `  top failing checks: ${view.failuresByCheck.map((f) => `${f.name}×${f.failures}`).join(', ')}`,
    );
  }
  if (view.sessions.length > 0) {
    out.push(`  sessions: ${view.sessions.map((s) => `${s.id}(${s.activity})`).join(', ')}`);
  }
  if (view.reviewPulls.length > 0) {
    out.push('  PRs awaiting review:');
    for (const p of view.reviewPulls) out.push(`    #${p.number} ${p.title} — ${p.url}`);
  }
  out.push('');
  out.push(
    paint(`as of ${new Date(view.asOfMs).toISOString().slice(11, 16)}`, CODES.dim, options.color),
  );
  return out.join('\n');
}
