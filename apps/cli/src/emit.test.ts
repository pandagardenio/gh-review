import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionRecord } from '@triage/fleet';
import { parseLedgerLine } from '@triage/fleet';
import { afterEach, describe, expect, it } from 'vitest';
import { emit } from './emit.js';

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

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'triage-emit-'));
  dirs.push(dir);
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  run(dir, 'config', 'user.email', 'dev@example.com');
  run(dir, 'config', 'user.name', 'Dev Person');
  run(dir, 'remote', 'add', 'origin', 'git@github.com:acme/widgets.git');
  writeFileSync(join(dir, 'f.txt'), 'x');
  run(dir, 'add', '.');
  run(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function ledgerLines(repo: string): string[] {
  return run(repo, 'cat-file', '-p', 'refs/heads/triage/ledger:ledger.jsonl')
    .split('\n')
    .filter(Boolean);
}

const PERSON_KEYS = ['login', 'email', 'user', 'author', 'host', 'hostname'];

describe('emit', () => {
  it('appends a session-start record with the repo derived from origin', () => {
    const repo = initRepo();
    const result = emit('session-start', {
      cwd: repo,
      sessionId: 'sess-1',
      remote: null,
      nowIso: '2026-06-10T08:00:00.000Z',
    });
    expect(result.emitted).toBe(true);

    const lines = ledgerLines(repo);
    expect(lines).toHaveLength(1);
    const record = sessionOf(lines[0] ?? '');
    expect(record.repo).toBe('acme/widgets');
    expect(record.status).toBe('running');
    for (const key of Object.keys(record)) {
      expect(PERSON_KEYS).not.toContain(key.toLowerCase());
    }
    expect(run(repo, 'status', '--porcelain')).toBe(''); // working tree untouched
  });

  it('throttles heartbeats within the window, then allows one after it', () => {
    const repo = initRepo();
    const base = 1_000_000;
    expect(
      emit('heartbeat', { cwd: repo, sessionId: 's', remote: null, nowMs: base }).emitted,
    ).toBe(true);
    expect(
      emit('heartbeat', { cwd: repo, sessionId: 's', remote: null, nowMs: base + 1000 }).emitted,
    ).toBe(false);
    expect(
      emit('heartbeat', { cwd: repo, sessionId: 's', remote: null, nowMs: base + 4 * 60_000 })
        .emitted,
    ).toBe(true);
    expect(ledgerLines(repo)).toHaveLength(2); // first + post-window, not the throttled one
  });

  it('carries the session start time onto the end snapshot', () => {
    const repo = initRepo();
    emit('session-start', {
      cwd: repo,
      sessionId: 's',
      remote: null,
      nowIso: '2026-06-10T08:00:00.000Z',
    });
    emit('session-end', {
      cwd: repo,
      sessionId: 's',
      remote: null,
      nowIso: '2026-06-10T09:00:00.000Z',
    });
    const end = sessionOf(ledgerLines(repo)[1] ?? '');
    expect(end.startedAt).toBe('2026-06-10T08:00:00.000Z');
    expect(end.status).toBe('success');
  });

  it('reports a non-git directory instead of throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'triage-nogit-'));
    dirs.push(dir);
    expect(emit('session-start', { cwd: dir, sessionId: 's', remote: null }).emitted).toBe(false);
  });
});
