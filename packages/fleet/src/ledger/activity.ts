/**
 * Session liveness (BL-027): is a session running *right now*, crashed, or done?
 *
 * A `running` snapshot is **active** only while its heartbeat is fresh; past the
 * window it is **stale** (a likely crash), rendered distinctly so an "N active"
 * count never silently includes ghosts. Everything terminal is **ended**.
 *
 * The freshness window is coupled to the emitter's heartbeat throttle (BL-026): it
 * must be comfortably larger, so a live session that simply hasn't beaten in a
 * throttle interval is never mistaken for stale. See `../docs/session-ledger.md`.
 */

import type { SessionRecord } from '../model/session.js';

/** Default freshness window (~10 min) vs BL-026's ~3-min heartbeat throttle. */
export const DEFAULT_FRESHNESS_MS = 10 * 60 * 1000;

export type SessionActivity = 'active' | 'stale' | 'ended';

export function sessionActivity(
  session: SessionRecord,
  nowMs: number,
  freshnessMs: number = DEFAULT_FRESHNESS_MS,
): SessionActivity {
  if (session.status !== 'running' || session.endedAt !== null) return 'ended';
  const beat = session.heartbeatAt ? Date.parse(session.heartbeatAt) : Number.NaN;
  if (Number.isNaN(beat) || nowMs - beat > freshnessMs) return 'stale';
  return 'active';
}

export interface SessionCounts {
  readonly active: number;
  readonly stale: number;
  readonly ended: number;
}

/** Count sessions by liveness — the "how many running now" (+ ghosts) numbers. */
export function countActivity(
  sessions: readonly SessionRecord[],
  nowMs: number,
  freshnessMs: number = DEFAULT_FRESHNESS_MS,
): SessionCounts {
  const counts = { active: 0, stale: 0, ended: 0 };
  for (const session of sessions) counts[sessionActivity(session, nowMs, freshnessMs)] += 1;
  return counts;
}
