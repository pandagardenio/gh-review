/**
 * Orchestrate one `triage emit` (BL-026): resolve context, throttle heartbeats,
 * build the record, and append it to the ledger. Designed to never break a
 * session — the caller (`main`) always exits 0; failures are returned, not thrown.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { LedgerEntry } from '@triage/fleet';
import { gitMaybe } from './git.js';
import { appendRecord } from './ledger.js';
import {
  buildHookEvent,
  buildSession,
  currentBranch,
  deriveRepo,
  type EmitContext,
  type HookFields,
  type SessionFields,
  type SessionKind,
} from './records.js';

/** At most one heartbeat per this interval — PostToolUse fires far too often to commit each. */
const HEARTBEAT_THROTTLE_MS = 3 * 60 * 1000;

export type EmitKind = SessionKind | 'hook-event';

export interface EmitOptions {
  readonly cwd: string;
  readonly sessionId: string;
  readonly nowMs?: number;
  readonly nowIso?: string;
  readonly remote?: string | null;
  readonly session?: SessionFields;
  readonly hook?: HookFields;
}

export interface EmitResult {
  readonly emitted: boolean;
  readonly reason?: string;
}

export function emit(kind: EmitKind, options: EmitOptions): EmitResult {
  const gitDir = gitMaybe(['rev-parse', '--git-dir'], { cwd: options.cwd });
  if (!gitDir) return { emitted: false, reason: 'not a git repository' };
  const stateDir = join(isAbsolute(gitDir) ? gitDir : join(options.cwd, gitDir), 'triage');

  const nowMs = options.nowMs ?? Date.now();
  if (kind === 'heartbeat' && isThrottled(stateDir, options.sessionId, nowMs)) {
    return { emitted: false, reason: 'heartbeat throttled' };
  }
  if (kind === 'hook-event' && !options.hook) {
    return { emitted: false, reason: 'hook-event requires --hook and --outcome' };
  }

  const ctx: EmitContext = {
    repo: deriveRepo(options.cwd),
    sessionId: options.sessionId,
    branch: currentBranch(options.cwd),
    nowIso: options.nowIso ?? new Date(nowMs).toISOString(),
  };

  const entry: LedgerEntry =
    kind === 'hook-event'
      ? { type: 'hook', record: buildHookEvent(ctx, options.hook as HookFields) }
      : {
          type: 'session',
          record: buildSession(kind, ctx, sessionFields(kind, stateDir, ctx, options.session)),
        };

  appendRecord(entry, { cwd: options.cwd, remote: options.remote });
  if (kind === 'heartbeat') stamp(stateDir, `heartbeat-${options.sessionId}`, String(nowMs));
  return { emitted: true };
}

/** Stash the real start time at session-start; reuse it on heartbeat/end snapshots. */
function sessionFields(
  kind: SessionKind,
  stateDir: string,
  ctx: EmitContext,
  provided: SessionFields | undefined,
): SessionFields {
  if (kind === 'session-start') {
    stamp(stateDir, `session-${ctx.sessionId}`, ctx.nowIso);
    return { ...provided, startedAt: ctx.nowIso };
  }
  const started = read(stateDir, `session-${ctx.sessionId}`);
  return { ...provided, startedAt: started ?? provided?.startedAt ?? ctx.nowIso };
}

function isThrottled(stateDir: string, sessionId: string, nowMs: number): boolean {
  const last = read(stateDir, `heartbeat-${sessionId}`);
  if (!last) return false;
  const at = Number(last);
  return Number.isFinite(at) && nowMs - at < HEARTBEAT_THROTTLE_MS;
}

function stamp(stateDir: string, name: string, value: string): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, name), value);
}

function read(stateDir: string, name: string): string | null {
  const path = join(stateDir, name);
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null;
}
