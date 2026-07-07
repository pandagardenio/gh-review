/**
 * Read a whole ledger file (BL-027): parse each JSONL line, **skip-and-count**
 * malformed ones (never fail a repo on one bad record), and fold session snapshots
 * to the latest per id. The file is append-only and chronological, so the last
 * line for a session id is its newest snapshot (start → heartbeat(s) → end).
 */

import type { HookEventRecord, SessionRecord } from '../model/session.js';
import { parseLedgerLine } from './schema.js';

export interface LedgerContents {
  /** One latest snapshot per session id. */
  readonly sessions: readonly SessionRecord[];
  readonly hookEvents: readonly HookEventRecord[];
  /** Lines that failed to parse — surfaced, never silently dropped. */
  readonly unparseable: number;
}

export function parseLedger(text: string): LedgerContents {
  const latest = new Map<string, SessionRecord>();
  const hookEvents: HookEventRecord[] = [];
  let unparseable = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let entry: ReturnType<typeof parseLedgerLine>;
    try {
      entry = parseLedgerLine(line);
    } catch {
      unparseable += 1;
      continue;
    }
    if (entry.type === 'session') latest.set(entry.record.id, entry.record);
    else hookEvents.push(entry.record);
  }

  return { sessions: [...latest.values()], hookEvents, unparseable };
}
