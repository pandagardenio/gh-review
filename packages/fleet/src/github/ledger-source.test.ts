import { describe, expect, it } from 'vitest';
import { serializeLedgerLine } from '../ledger/schema.js';
import { LedgerFleetSource } from './ledger-source.js';

const tokens = { get: async () => 'tok', set: async () => {}, clear: async () => {} };

function textRes(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    headers: { get: () => null },
  } as unknown as Response;
}

const source = (fetch: typeof globalThis.fetch) => new LedgerFleetSource({ tokens, fetch });

const ledgerLine = serializeLedgerLine({
  type: 'session',
  record: {
    id: 's1',
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
  },
});

describe('LedgerFleetSource', () => {
  it('parses the ledger branch file into sessions', async () => {
    const src = source((async () => textRes(ledgerLine)) as unknown as typeof globalThis.fetch);
    const sessions = await src.listSessions('acme/widgets');
    expect(sessions).toHaveLength(1);
    expect(sessions?.[0]?.id).toBe('s1');
  });

  it('returns null when the repo has no triage/ledger branch (404)', async () => {
    const src = source((async () =>
      textRes('Not Found', 404)) as unknown as typeof globalThis.fetch);
    expect(await src.listSessions('acme/widgets')).toBeNull();
    expect(await src.listHookEvents('acme/widgets')).toBeNull();
  });

  it('requests the ledger file with a ref of triage/ledger', async () => {
    let requested = '';
    const src = source((async (url: string) => {
      requested = url;
      return textRes(ledgerLine);
    }) as unknown as typeof globalThis.fetch);
    await src.listSessions('acme/widgets');
    expect(requested).toContain('/repos/acme/widgets/contents/ledger.jsonl?ref=triage/ledger');
  });
});
