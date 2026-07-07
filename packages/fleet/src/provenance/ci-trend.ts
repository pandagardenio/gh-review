/**
 * CI health over time: agent (and baseline) failure rate per day/week bucket, so
 * a surface can draw the "are agents failing CI more lately" series (BL-023).
 * Shares the bucketing helper with the provenance trend so the two align.
 */

import type { CheckRecord, PullRecord } from '../model/github.js';
import type { AgentIdentityConfig } from './agent-identity.js';
import { DEFAULT_AGENT_IDENTITY } from './agent-identity.js';
import { ciHealth } from './ci-health.js';
import type { ProvenanceWindow } from './share.js';
import { eachBucketWindow } from './share.js';
import type { TrendBucket } from './trend.js';

export interface CiHealthTrendPoint {
  /** Inclusive ISO start of the bucket. */
  readonly start: string;
  readonly agentFailureRate: number | null;
  readonly humanFailureRate: number | null;
}

/** Split the window into buckets, each carrying agent + baseline failure rates. */
export function ciHealthTrend(
  pulls: readonly PullRecord[],
  checks: readonly CheckRecord[],
  window: ProvenanceWindow,
  bucket: TrendBucket,
  config: AgentIdentityConfig = DEFAULT_AGENT_IDENTITY,
): CiHealthTrendPoint[] {
  return eachBucketWindow(window, bucket === 'week' ? 7 : 1).map((slice) => {
    const health = ciHealth(pulls, checks, slice, config);
    return {
      start: slice.since,
      agentFailureRate: health.agent.failureRate,
      humanFailureRate: health.human.failureRate,
    };
  });
}
