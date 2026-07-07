import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LedgerEntry, SessionRecord } from '@triage/fleet';
import { parseLedgerLine } from '@triage/fleet';
import { afterEach, describe, expect, it } from 'vitest';
import { appendRecord, mergeAppendOnly } from './ledger.js';

function sessionOf(line: string): SessionRecord {
  const entry = parseLedgerLine(line);
  if (entry.type !== 'session') throw new Error('expected a session record');
  return entry.record;
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function run(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function initRepo(bare = false): string {
  const dir = mkdtempSync(join(tmpdir(), 'triage-cli-'));
  dirs.push(dir);
  execFileSync('git', ['init', '-q', ...(bare ? ['--bare'] : []), '-b', 'main', dir]);
  if (!bare) {
    run(dir, 'config', 'user.email', 'dev@example.com');
    run(dir, 'config', 'user.name', 'Dev Person');
    writeFileSync(join(dir, 'file.txt'), 'hello');
    run(dir, 'add', '.');
    run(dir, 'commit', '-q', '-m', 'init');
  }
  return dir;
}

function session(id: string, status: 'running' | 'success'): LedgerEntry {
  return {
    type: 'session',
    record: {
      id,
      repo: 'acme/widgets',
      agent: 'claude-code',
      status,
      startedAt: '2026-06-10T08:00:00.000Z',
      endedAt: status === 'success' ? '2026-06-10T09:00:00.000Z' : null,
      heartbeatAt: '2026-06-10T08:30:00.000Z',
      stage: null,
      branch: 'claude/x',
      pr: null,
      failureReason: null,
      usage: { tokensIn: null, tokensOut: null, wallSeconds: 0, toolCalls: 0 },
    },
  };
}

describe('appendRecord', () => {
  it('writes two schema-valid lines to triage/ledger without touching the working branch', () => {
    const repo = initRepo();
    const headBefore = run(repo, 'rev-parse', 'HEAD');

    appendRecord(session('s1', 'running'), { cwd: repo, remote: null });
    appendRecord(session('s1', 'success'), { cwd: repo, remote: null });

    const lines = run(repo, 'cat-file', '-p', 'refs/heads/triage/ledger:ledger.jsonl').split('\n');
    expect(lines).toHaveLength(2);
    expect(sessionOf(lines[0] ?? '').status).toBe('running');
    expect(sessionOf(lines[1] ?? '').status).toBe('success');

    // The developer's branch, HEAD, and working tree are all untouched.
    expect(run(repo, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect(run(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(run(repo, 'status', '--porcelain')).toBe('');
  });

  it('commits the ledger under a machine identity, never the developer', () => {
    const repo = initRepo();
    appendRecord(session('s1', 'running'), { cwd: repo, remote: null });
    const author = run(repo, 'log', '-1', '--format=%an <%ae>', 'refs/heads/triage/ledger');
    expect(author).toBe('triage-emitter <triage-emitter@localhost>');
  });

  it('queues locally and exits when the push fails, losing no record', () => {
    const repo = initRepo();
    run(repo, 'remote', 'add', 'origin', join(tmpdir(), 'does-not-exist.git'));

    // Push (and fetch) fail against the missing remote — records still land locally.
    expect(appendRecord(session('s1', 'running'), { cwd: repo }).pushed).toBe(false);
    expect(appendRecord(session('s1', 'success'), { cwd: repo }).pushed).toBe(false);

    const lines = run(repo, 'cat-file', '-p', 'refs/heads/triage/ledger:ledger.jsonl').split('\n');
    expect(lines).toHaveLength(2);
  });

  it('pushes to a reachable remote and flushes everything pending', () => {
    const remote = initRepo(true);
    const repo = initRepo();
    run(repo, 'remote', 'add', 'origin', remote);

    expect(appendRecord(session('s1', 'running'), { cwd: repo }).pushed).toBe(true);
    const remoteLines = run(remote, 'cat-file', '-p', 'refs/heads/triage/ledger:ledger.jsonl');
    expect(remoteLines.split('\n')).toHaveLength(1);
  });
});

describe('mergeAppendOnly', () => {
  it('unions remote-first, then local-only lines', () => {
    expect(mergeAppendOnly('r1\nr2\n', 'r1\nr2\nl1\n')).toBe('r1\nr2\nl1\n');
    expect(mergeAppendOnly('', 'x\n')).toBe('x\n');
    expect(mergeAppendOnly('r1\n', 'l1\n')).toBe('r1\nl1\n');
    expect(mergeAppendOnly('', '')).toBe('');
  });
});
