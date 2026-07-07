/**
 * Build ledger records (BL-026) from the emit context. The only identity a record
 * carries is the agent (`claude-code`) — never a developer's login, email, or host
 * (CONTROL-ROOM-CONSTITUTION.md principle 1). Uses the `@triage/fleet` schema types.
 */

import type { HookEventRecord, HookOutcome, SessionRecord, SessionStatus } from '@triage/fleet';
import { gitMaybe } from './git.js';

const AGENT = 'claude-code';

export interface EmitContext {
  readonly repo: string;
  readonly sessionId: string;
  readonly branch: string | null;
  readonly nowIso: string;
}

/** Derive the `owner/name` slug from origin's URL, falling back to the repo dir name. */
export function deriveRepo(cwd: string): string {
  const url = gitMaybe(['remote', 'get-url', 'origin'], { cwd });
  const slug = url ? parseRepoSlug(url) : null;
  if (slug) return slug;
  const top = gitMaybe(['rev-parse', '--show-toplevel'], { cwd });
  return top ? (top.split('/').pop() ?? 'unknown') : 'unknown';
}

/** Extract `owner/name` from an SSH or HTTPS remote URL. */
export function parseRepoSlug(url: string): string | null {
  const match = /[:/]([^/:]+\/[^/:]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match?.[1] ?? null;
}

export function currentBranch(cwd: string): string | null {
  const branch = gitMaybe(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
  return branch && branch !== 'HEAD' ? branch : null;
}

export interface SessionFields {
  readonly status?: SessionStatus;
  readonly startedAt?: string;
  readonly pr?: number | null;
  readonly failureReason?: string | null;
}

export type SessionKind = 'session-start' | 'session-end' | 'heartbeat';

export function buildSession(
  kind: SessionKind,
  ctx: EmitContext,
  fields: SessionFields = {},
): SessionRecord {
  const status: SessionStatus = kind === 'session-end' ? (fields.status ?? 'success') : 'running';
  return {
    id: ctx.sessionId,
    repo: ctx.repo,
    agent: AGENT,
    status,
    startedAt: fields.startedAt ?? ctx.nowIso,
    endedAt: kind === 'session-end' ? ctx.nowIso : null,
    heartbeatAt: ctx.nowIso,
    stage: null,
    branch: ctx.branch,
    pr: fields.pr ?? null,
    failureReason: fields.failureReason ?? null,
    // Usage is best-effort in v1 — the hook payload does not carry token/tool totals.
    usage: { tokensIn: null, tokensOut: null, wallSeconds: 0, toolCalls: 0 },
  };
}

export interface HookFields {
  readonly hook: string;
  readonly outcome: HookOutcome;
  readonly ruleId?: string | null;
}

export function buildHookEvent(ctx: EmitContext, fields: HookFields): HookEventRecord {
  return {
    id: `${ctx.sessionId}:${ctx.nowIso}:${fields.hook}`,
    sessionId: ctx.sessionId,
    repo: ctx.repo,
    hook: fields.hook,
    ruleId: fields.ruleId ?? null,
    outcome: fields.outcome,
    at: ctx.nowIso,
  };
}
