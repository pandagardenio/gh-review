import { describe, expect, it } from 'vitest';
import { type FactoryRun, mapFactoryRunToSession } from './factory-compat.js';

const run: FactoryRun = {
  id: '01J0D',
  station: 'implement',
  status: 'failure',
  startedAt: '2026-06-28T04:00:00.000Z',
  endedAt: '2026-06-28T04:10:00.000Z',
  failureReason: 'ci-failed',
  usage: { tokensIn: 68_400, tokensOut: 30_400, wallSeconds: 760, toolCalls: 240 },
  pr: 118,
};

describe('mapFactoryRunToSession', () => {
  it('maps a factory Run onto a SessionRecord without losing status or usage', () => {
    const session = mapFactoryRunToSession(run, 'acme/widgets');
    expect(session).toMatchObject({
      id: '01J0D',
      repo: 'acme/widgets',
      agent: 'claude-code',
      status: 'failure',
      stage: 'implement',
      failureReason: 'ci-failed',
      pr: 118,
    });
    expect(session.usage).toEqual(run.usage);
  });

  it('stands in the end time for the absent heartbeat', () => {
    expect(mapFactoryRunToSession(run, 'r').heartbeatAt).toBe('2026-06-28T04:10:00.000Z');
    const running = mapFactoryRunToSession({ ...run, status: 'running', endedAt: null }, 'r');
    expect(running.heartbeatAt).toBe(running.startedAt);
  });
});
