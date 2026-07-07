/**
 * Compatibility mapping (BL-027): a dark-factory `factory/ledger` `RunRecord` maps
 * onto a fleet {@link SessionRecord}, so the existing single-repo prototype stays
 * legible in the generalized cockpit. A factory *Run* is one station invocation;
 * it shares the session status vocabulary and usage shape, so nothing is lost — the
 * station becomes the session's `stage` tag.
 */

import type { SessionRecord, SessionStatus, SessionUsage } from '../model/session.js';

/** The slice of a factory `RunRecord` we map from (mirrors the prototype's schema). */
export interface FactoryRun {
  readonly id: string;
  readonly station: string;
  readonly status: SessionStatus;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly failureReason: string | null;
  readonly usage: SessionUsage;
  readonly pr: number | null;
}

/** Map a factory Run onto a SessionRecord for the given repo. Status/usage preserved. */
export function mapFactoryRunToSession(run: FactoryRun, repo: string): SessionRecord {
  return {
    id: run.id,
    repo,
    agent: 'claude-code',
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    // Factory runs carry no heartbeat; the end (or start, while running) stands in.
    heartbeatAt: run.endedAt ?? run.startedAt,
    stage: run.station,
    branch: null,
    pr: run.pr,
    failureReason: run.failureReason,
    usage: run.usage,
  };
}
