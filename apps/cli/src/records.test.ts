import { describe, expect, it } from 'vitest';
import { buildHookEvent, buildSession, type EmitContext, parseRepoSlug } from './records.js';

const ctx: EmitContext = {
  repo: 'acme/widgets',
  sessionId: 'sess-1',
  branch: 'claude/x',
  nowIso: '2026-06-10T08:00:00.000Z',
};

const PERSON_KEYS = ['login', 'email', 'user', 'username', 'author', 'host', 'hostname'];

describe('parseRepoSlug', () => {
  it('parses SSH, HTTPS, and .git-suffixed remotes to owner/name', () => {
    expect(parseRepoSlug('git@github.com:acme/widgets.git')).toBe('acme/widgets');
    expect(parseRepoSlug('https://github.com/acme/widgets.git')).toBe('acme/widgets');
    expect(parseRepoSlug('https://github.com/acme/widgets')).toBe('acme/widgets');
    expect(parseRepoSlug('git@github.com:acme/widgets')).toBe('acme/widgets');
  });
});

describe('buildSession', () => {
  it('marks session-start running with no end', () => {
    const record = buildSession('session-start', ctx);
    expect(record.status).toBe('running');
    expect(record.endedAt).toBeNull();
    expect(record.agent).toBe('claude-code');
  });

  it('marks session-end success (or the given status) with an end time', () => {
    expect(buildSession('session-end', ctx).status).toBe('success');
    expect(buildSession('session-end', ctx, { status: 'failure' }).status).toBe('failure');
    expect(buildSession('session-end', ctx).endedAt).toBe(ctx.nowIso);
  });

  it('carries only an agent identity — no developer field', () => {
    const record = buildSession('session-start', ctx);
    for (const key of Object.keys(record)) {
      expect(PERSON_KEYS).not.toContain(key.toLowerCase());
    }
    expect(record.agent).toBe('claude-code');
  });
});

describe('buildHookEvent', () => {
  it('builds a hook-friction record with rule id and outcome', () => {
    const record = buildHookEvent(ctx, {
      hook: 'PreToolUse',
      outcome: 'block',
      ruleId: 'file-size',
    });
    expect(record).toMatchObject({
      sessionId: 'sess-1',
      repo: 'acme/widgets',
      hook: 'PreToolUse',
      outcome: 'block',
      ruleId: 'file-size',
    });
  });
});
