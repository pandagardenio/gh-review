/**
 * Provenance over time: the share computed per day/week bucket so a surface can
 * draw a series (BL-022). Buckets tile the window left-to-right; the last bucket
 * is clamped to the window end.
 */

import type { CommitRecord, PullRecord } from '../model/github.js';
import type { AgentIdentityConfig } from './agent-identity.js';
import { DEFAULT_AGENT_IDENTITY } from './agent-identity.js';
import type { ProvenanceWindow } from './share.js';
import { eachBucketWindow, provenanceShare } from './share.js';

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
  return eachBucketWindow(window, bucket === 'week' ? 7 : 1).map((slice) => {
    const share = provenanceShare(commits, pulls, slice, config);
    return { start: slice.since, prShare: share.prShare, lineShare: share.lineShare };
  });
}
