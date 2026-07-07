import { describe, expect, it } from 'vitest';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import { parseLedger } from './read.js';
import { serializeLedgerLine } from './schema.js';

function session(id: string, over: Partial<SessionRecord> = {}): string {
  return serializeLedgerLine({
    type: 'session',
    record: {
      id,
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
      ...over,
    },
  });
}

function hook(id: string): string {
  const record: HookEventRecord = {
    id,
    sessionId: 'sess-1',
    repo: 'acme/widgets',
    hook: 'PreToolUse',
    ruleId: 'file-size',
    outcome: 'block',
    at: '2026-06-10T08:03:00.000Z',
  };
  return serializeLedgerLine({ type: 'hook', record });
}

describe('parseLedger', () => {
  it('folds session snapshots to the latest per id', () => {
    const text = [
      session('sess-1', { status: 'running' }),
      session('sess-1', { status: 'success', endedAt: '2026-06-10T09:00:00.000Z' }),
      session('sess-2', { status: 'running' }),
    ].join('\n');
    const { sessions } = parseLedger(text);
    expect(sessions).toHaveLength(2);
    expect(sessions.find((s) => s.id === 'sess-1')?.status).toBe('success');
  });

  it('collects hook events separately', () => {
    const { hookEvents, sessions } = parseLedger(
      [session('s1'), hook('h1'), hook('h2')].join('\n'),
    );
    expect(sessions).toHaveLength(1);
    expect(hookEvents).toHaveLength(2);
  });

  it('skips and counts malformed lines, keeping the rest', () => {
    const text = [session('s1'), 'not json at all', '{"v":1,"type":"session"}', session('s2')].join(
      '\n',
    );
    const result = parseLedger(text);
    expect(result.sessions).toHaveLength(2); // s1, s2
    expect(result.unparseable).toBe(2); // the junk line + the incomplete record
  });

  it('ignores blank lines', () => {
    expect(parseLedger('\n\n').sessions).toEqual([]);
    expect(parseLedger('\n\n').unparseable).toBe(0);
  });
});
