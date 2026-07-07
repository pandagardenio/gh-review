/**
 * The session-ledger wire format: newline-delimited JSON on a repo's
 * `triage/ledger` branch. The emitter (BL-026) appends lines; the ledger source
 * (BL-027) reads them. See `docs/session-ledger.md` for the full contract.
 *
 * Each line is a versioned, tagged record — a {@link SessionRecord} snapshot or a
 * {@link HookEventRecord}. Sessions are append-only snapshots that share an `id`
 * (start → heartbeat(s) → end); the reader folds to the latest per id. Parsing
 * tolerates unknown fields (forward compatibility) and throws {@link LedgerParseError}
 * on a malformed line so the reader can skip-and-count rather than fail a whole repo.
 */

import type {
  HookEventRecord,
  HookOutcome,
  SessionRecord,
  SessionStatus,
  SessionUsage,
} from '../model/session.js';

/** Bumped when the wire format changes incompatibly. Readers tolerate unknown fields. */
export const LEDGER_SCHEMA_VERSION = 1;

/** A parsed ledger line — one of the two record kinds. */
export type LedgerEntry =
  | { readonly type: 'session'; readonly record: SessionRecord }
  | { readonly type: 'hook'; readonly record: HookEventRecord };

/** Thrown when a line can't be parsed; the reader skips-and-counts these (BL-027). */
export class LedgerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerParseError';
  }
}

/** Serialize a session or hook record to one wire line (no trailing newline). */
export function serializeLedgerLine(entry: LedgerEntry): string {
  const envelope = { v: LEDGER_SCHEMA_VERSION, type: entry.type, ...entry.record };
  return JSON.stringify(envelope);
}

/** Parse one wire line into a tagged entry, or throw {@link LedgerParseError}. */
export function parseLedgerLine(line: string): LedgerEntry {
  const obj = asObject(line);
  if (typeof obj.v !== 'number') {
    throw new LedgerParseError("missing or non-numeric 'v' (schema version)");
  }
  const type = obj.type;
  if (type === 'session') return { type: 'session', record: parseSession(obj) };
  if (type === 'hook') return { type: 'hook', record: parseHook(obj) };
  throw new LedgerParseError(`unknown record type '${String(type)}'`);
}

type Json = Record<string, unknown>;

const SESSION_STATUSES: readonly SessionStatus[] = ['running', 'success', 'failure', 'escalated'];
const HOOK_OUTCOMES: readonly HookOutcome[] = ['allow', 'block', 'warn'];

function asObject(line: string): Json {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    throw new LedgerParseError(`not valid JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LedgerParseError('line is not a JSON object');
  }
  return parsed as Json;
}

function str(obj: Json, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string') throw new LedgerParseError(`field '${key}' must be a string`);
  return value;
}

function strOrNull(obj: Json, key: string): string | null {
  const value = obj[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new LedgerParseError(`field '${key}' must be a string or null`);
  }
  return value;
}

function num(obj: Json, key: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LedgerParseError(`field '${key}' must be a number`);
  }
  return value;
}

function numOrNull(obj: Json, key: string): number | null {
  const value = obj[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LedgerParseError(`field '${key}' must be a number or null`);
  }
  return value;
}

function usage(obj: Json): SessionUsage {
  const raw = obj.usage;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new LedgerParseError("field 'usage' must be an object");
  }
  const u = raw as Json;
  return {
    tokensIn: numOrNull(u, 'tokensIn'),
    tokensOut: numOrNull(u, 'tokensOut'),
    wallSeconds: num(u, 'wallSeconds'),
    toolCalls: num(u, 'toolCalls'),
  };
}

function parseSession(obj: Json): SessionRecord {
  const status = str(obj, 'status');
  if (!(SESSION_STATUSES as readonly string[]).includes(status)) {
    throw new LedgerParseError(`unknown session status '${status}'`);
  }
  return {
    id: str(obj, 'id'),
    repo: str(obj, 'repo'),
    agent: str(obj, 'agent'),
    status: status as SessionStatus,
    startedAt: str(obj, 'startedAt'),
    endedAt: strOrNull(obj, 'endedAt'),
    heartbeatAt: strOrNull(obj, 'heartbeatAt'),
    stage: strOrNull(obj, 'stage'),
    branch: strOrNull(obj, 'branch'),
    pr: numOrNull(obj, 'pr'),
    failureReason: strOrNull(obj, 'failureReason'),
    usage: usage(obj),
  };
}

function parseHook(obj: Json): HookEventRecord {
  const outcome = str(obj, 'outcome');
  if (!(HOOK_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new LedgerParseError(`unknown hook outcome '${outcome}'`);
  }
  return {
    id: str(obj, 'id'),
    sessionId: str(obj, 'sessionId'),
    repo: str(obj, 'repo'),
    hook: str(obj, 'hook'),
    ruleId: strOrNull(obj, 'ruleId'),
    outcome: outcome as HookOutcome,
    at: str(obj, 'at'),
  };
}
