/**
 * Provenance over time: the share computed per day/week bucket so a surface can
 * draw a series (BL-022). Buckets tile the window left-to-right; the last bucket
 * is clamped to the window end.
 */

import type { CommitRecord, PullRecord } from '../model/github.js';
import type { AgentIdentityConfig } from './agent-identity.js';
import { DEFAULT_AGENT_IDENTITY } from './agent-identity.js';
import type { ProvenanceWindow } from './share.js';
import { provenanceShare } from './share.js';

const DAY_MS = 86_400_000;

export type TrendBucket = 'day' | 'week';

export interface ProvenanceTrendPoint {
  /** Inclusive ISO start of the bucket. */
  readonly start: string;
  readonly prShare: number | null;
  readonly lineShare: number | null;
}

/** Split the window into `bucket`-sized points, each carrying its own shares. */
export function provenanceTrend(
  commits: readonly CommitRecord[],
  pulls: readonly PullRecord[],
  window: ProvenanceWindow,
  bucket: TrendBucket,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): ProvenanceTrendPoint[] {
  const step = (bucket === 'week' ? 7 : 1) * DAY_MS;
  const start = Date.parse(window.since);
  const end = Date.parse(window.until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

  const points: ProvenanceTrendPoint[] = [];
  for (let t = start; t < end; t += step) {
    const slice: ProvenanceWindow = {
      since: new Date(t).toISOString(),
      until: new Date(Math.min(t + step, end)).toISOString(),
    };
    const share = provenanceShare(commits, pulls, slice, config);
    points.push({ start: slice.since, prShare: share.prShare, lineShare: share.lineShare });
  }
  return points;
}
