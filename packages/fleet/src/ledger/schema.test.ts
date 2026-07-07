import { describe, expect, it } from 'vitest';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import {
  LEDGER_SCHEMA_VERSION,
  LedgerParseError,
  parseLedgerLine,
  serializeLedgerLine,
} from './schema.js';

const SESSION: SessionRecord = {
  id: 'sess-1',
  repo: 'acme/widgets',
  agent: 'claude-code',
  status: 'running',
  startedAt: '2026-06-26T12:00:00.000Z',
  endedAt: null,
  heartbeatAt: '2026-06-26T12:14:00.000Z',
  stage: 'implement',
  branch: 'claude/thing',
  pr: 120,
  failureReason: null,
  usage: { tokensIn: null, tokensOut: null, wallSeconds: 840, toolCalls: 61 },
};

const HOOK: HookEventRecord = {
  id: 'hook-1',
  sessionId: 'sess-1',
  repo: 'acme/widgets',
  hook: 'PreToolUse',
  ruleId: 'csp-safe-dom',
  outcome: 'block',
  at: '2026-06-26T12:05:00.000Z',
};

describe('ledger schema', () => {
  it('round-trips a session record', () => {
    const line = serializeLedgerLine({ type: 'session', record: SESSION });
    const parsed = parseLedgerLine(line);
    expect(parsed).toEqual({ type: 'session', record: SESSION });
  });

  it('round-trips a hook record', () => {
    const line = serializeLedgerLine({ type: 'hook', record: HOOK });
    const parsed = parseLedgerLine(line);
    expect(parsed).toEqual({ type: 'hook', record: HOOK });
  });

  it('stamps the current schema version on serialized lines', () => {
    const line = serializeLedgerLine({ type: 'session', record: SESSION });
    expect(JSON.parse(line).v).toBe(LEDGER_SCHEMA_VERSION);
  });

  it('tolerates unknown fields and a future version (forward compatibility)', () => {
    const envelope = {
      v: LEDGER_SCHEMA_VERSION + 1,
      type: 'session',
      ...SESSION,
      futureField: 'ignored',
      usage: { ...SESSION.usage, futureUsage: 7 },
    };
    const parsed = parseLedgerLine(JSON.stringify(envelope));
    expect(parsed).toEqual({ type: 'session', record: SESSION });
  });

  it('throws LedgerParseError on non-JSON', () => {
    expect(() => parseLedgerLine('not json')).toThrow(LedgerParseError);
  });

  it('throws on a missing required field', () => {
    const { agent, ...withoutAgent } = { v: 1, type: 'session', ...SESSION };
    void agent;
    expect(() => parseLedgerLine(JSON.stringify(withoutAgent))).toThrow(LedgerParseError);
  });

  it('throws on an unknown record type', () => {
    expect(() => parseLedgerLine(JSON.stringify({ v: 1, type: 'mystery' }))).toThrow(
      LedgerParseError,
    );
  });

  it('throws on an unknown session status', () => {
    const line = JSON.stringify({ v: 1, type: 'session', ...SESSION, status: 'paused' });
    expect(() => parseLedgerLine(line)).toThrow(LedgerParseError);
  });
});
