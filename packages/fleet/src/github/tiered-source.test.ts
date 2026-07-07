import { describe, expect, it } from 'vitest';
import { FixtureFleetSource } from '../fixture-source.js';
import type { SessionRecord } from '../model/session.js';
import type { RichReader } from './ledger-source.js';
import { TieredFleetSource } from './tiered-source.js';

const richSession: SessionRecord = {
  id: 'rich-1',
  repo: 'acme/widgets',
  agent: 'claude-code',
  status: 'running',
  startedAt: '2026-06-10T08:00:00.000Z',
  endedAt: null,
  heartbeatAt: '2026-06-10T08:05:00.000Z',
  stage: null,
  branch: null,
  pr: null,
  failureReason: null,
  usage: { tokensIn: null, tokensOut: null, wallSeconds: 0, toolCalls: 0 },
};

// Rich reader that only instruments acme/widgets; other repos report null (baseline).
const rich: RichReader = {
  listSessions: async (repo) => (repo === 'acme/widgets' ? [richSession] : null),
  listHookEvents: async () => null,
};

const tiered = () => new TieredFleetSource(new FixtureFleetSource(), rich);

describe('TieredFleetSource', () => {
  it('serves baseline reads from the baseline source', async () => {
    const commits = await tiered().listCommits('acme/widgets');
    expect(commits.length).toBeGreaterThan(0); // from the fixture baseline
  });

  it('serves rich reads from the ledger reader, not the baseline', async () => {
    const sessions = await tiered().listSessions('acme/widgets');
    expect(sessions?.map((s) => s.id)).toEqual(['rich-1']); // the reader's data, not fixtures'
  });

  it('reports null sessions for an uninstrumented repo (baseline tier)', async () => {
    expect(await tiered().listSessions('acme/docs-site')).toBeNull();
  });

  it('advertises itself as a live, non-fixture source', () => {
    expect(tiered().isFixture).toBe(false);
  });
});
