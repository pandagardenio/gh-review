/**
 * Baked rich-tier data for {@link FixtureFleetSource}: sessions and hook events
 * for the two instrumented repos. Includes a running session with a fresh
 * heartbeat, a completed one, and a stale one (old heartbeat, no end record) so
 * the active/stale derivation (BL-027) has all three cases to exercise.
 *
 * Every record's only identity is `agent` (`claude-code`) — no person appears,
 * by construction (CONTROL-ROOM-CONSTITUTION.md principle 1).
 */

import type { HookEventRecord, SessionRecord } from '../model/session.js';

const AGENT = 'claude-code';

export const FIXTURE_SESSIONS: Readonly<Record<string, readonly SessionRecord[]>> = {
  'acme/widgets': [
    {
      id: 'sess-w-1',
      repo: 'acme/widgets',
      agent: AGENT,
      status: 'success',
      startedAt: '2026-06-20T09:40:00.000Z',
      endedAt: '2026-06-20T10:05:00.000Z',
      heartbeatAt: '2026-06-20T10:04:00.000Z',
      stage: 'implement',
      branch: 'claude/cursor-pagination',
      pr: 118,
      failureReason: null,
      usage: { tokensIn: 82_000, tokensOut: 24_000, wallSeconds: 1500, toolCalls: 240 },
    },
    {
      id: 'sess-w-2',
      repo: 'acme/widgets',
      agent: AGENT,
      status: 'running',
      startedAt: '2026-06-26T12:00:00.000Z',
      endedAt: null,
      heartbeatAt: '2026-06-26T12:14:00.000Z',
      stage: 'implement',
      branch: 'claude/readme-tidy',
      pr: 120,
      failureReason: null,
      usage: { tokensIn: null, tokensOut: null, wallSeconds: 840, toolCalls: 61 },
    },
    {
      id: 'sess-w-3',
      repo: 'acme/widgets',
      agent: AGENT,
      status: 'running',
      startedAt: '2026-06-25T22:00:00.000Z',
      endedAt: null,
      heartbeatAt: '2026-06-25T22:20:00.000Z',
      stage: 'qa',
      branch: 'claude/flaky-retry',
      pr: null,
      failureReason: null,
      usage: { tokensIn: null, tokensOut: null, wallSeconds: 1200, toolCalls: 88 },
    },
  ],
  'acme/api': [
    {
      id: 'sess-a-1',
      repo: 'acme/api',
      agent: AGENT,
      status: 'failure',
      startedAt: '2026-06-21T10:30:00.000Z',
      endedAt: '2026-06-21T11:20:00.000Z',
      heartbeatAt: '2026-06-21T11:18:00.000Z',
      stage: 'implement',
      branch: 'claude/rate-limit-headers',
      pr: 119,
      failureReason: 'ci-failed',
      usage: { tokensIn: 140_000, tokensOut: 48_000, wallSeconds: 3000, toolCalls: 300 },
    },
    {
      id: 'sess-a-2',
      repo: 'acme/api',
      agent: AGENT,
      status: 'escalated',
      startedAt: '2026-06-24T16:00:00.000Z',
      endedAt: '2026-06-24T17:05:00.000Z',
      heartbeatAt: '2026-06-24T17:03:00.000Z',
      stage: 'qa',
      branch: 'claude/webhook-verifier',
      pr: 122,
      failureReason: 'review-rejected',
      usage: { tokensIn: 96_000, tokensOut: 30_000, wallSeconds: 3900, toolCalls: 210 },
    },
  ],
};

export const FIXTURE_HOOK_EVENTS: Readonly<Record<string, readonly HookEventRecord[]>> = {
  'acme/widgets': [
    {
      id: 'hook-w-1',
      sessionId: 'sess-w-1',
      repo: 'acme/widgets',
      hook: 'PreToolUse',
      ruleId: 'csp-safe-dom',
      outcome: 'block',
      at: '2026-06-20T09:55:00.000Z',
    },
  ],
  'acme/api': [
    {
      id: 'hook-a-1',
      sessionId: 'sess-a-1',
      repo: 'acme/api',
      hook: 'PreToolUse',
      ruleId: 'file-size',
      outcome: 'block',
      at: '2026-06-21T10:50:00.000Z',
    },
    {
      id: 'hook-a-2',
      sessionId: 'sess-a-2',
      repo: 'acme/api',
      hook: 'Stop',
      ruleId: null,
      outcome: 'warn',
      at: '2026-06-24T17:04:00.000Z',
    },
  ],
};
