import { describe, expect, it } from 'vitest';
import type { SessionRecord, SessionStatus } from '../model/session.js';
import { countActivity, DEFAULT_FRESHNESS_MS, sessionActivity } from './activity.js';

const NOW = Date.parse('2026-06-10T08:10:00.000Z');

function session(over: Partial<SessionRecord>): SessionRecord {
  return {
    id: 's',
    repo: 'acme/widgets',
    agent: 'claude-code',
    status: 'running',
    startedAt: '2026-06-10T08:00:00.000Z',
    endedAt: null,
    heartbeatAt: '2026-06-10T08:08:00.000Z',
    stage: null,
    branch: null,
    pr: null,
    failureReason: null,
    usage: { tokensIn: null, tokensOut: null, wallSeconds: 0, toolCalls: 0 },
    ...over,
  };
}

describe('sessionActivity', () => {
  it('is active when running with a fresh heartbeat', () => {
    expect(sessionActivity(session({ heartbeatAt: '2026-06-10T08:08:00.000Z' }), NOW)).toBe(
      'active',
    );
  });

  it('is stale when running but the heartbeat is past the window', () => {
    // NOW − 11min > 10min window.
    expect(sessionActivity(session({ heartbeatAt: '2026-06-10T07:59:00.000Z' }), NOW)).toBe(
      'stale',
    );
  });

  it('classifies exactly at the window boundary on both sides', () => {
    const justInside = new Date(NOW - DEFAULT_FRESHNESS_MS).toISOString();
    const justOutside = new Date(NOW - DEFAULT_FRESHNESS_MS - 1).toISOString();
    expect(sessionActivity(session({ heartbeatAt: justInside }), NOW)).toBe('active');
    expect(sessionActivity(session({ heartbeatAt: justOutside }), NOW)).toBe('stale');
  });

  it('is stale when a running session never beat', () => {
    expect(sessionActivity(session({ heartbeatAt: null }), NOW)).toBe('stale');
  });

  it('is ended for any terminal status or a set end time', () => {
    for (const status of ['success', 'failure', 'escalated'] as SessionStatus[]) {
      expect(sessionActivity(session({ status }), NOW)).toBe('ended');
    }
    expect(sessionActivity(session({ endedAt: '2026-06-10T08:09:00.000Z' }), NOW)).toBe('ended');
  });
});

describe('countActivity', () => {
  it('counts active, stale, and ended separately', () => {
    const counts = countActivity(
      [
        session({ heartbeatAt: '2026-06-10T08:09:00.000Z' }), // active
        session({ heartbeatAt: '2026-06-10T07:50:00.000Z' }), // stale
        session({ status: 'success' }), // ended
      ],
      NOW,
    );
    expect(counts).toEqual({ active: 1, stale: 1, ended: 1 });
  });
});
