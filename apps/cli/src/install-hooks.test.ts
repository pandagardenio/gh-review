import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installHooks } from './install-hooks.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'triage-hooks-'));
  dirs.push(dir);
  return dir;
}

describe('installHooks', () => {
  it('wires the emitter hooks into a fresh settings file', () => {
    const dir = tempDir();
    const result = installHooks(dir);
    expect(result.changed).toEqual(['SessionStart', 'Stop', 'PostToolUse']);
    const settings = JSON.parse(readFileSync(result.path, 'utf8'));
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe('triage emit session-start');
  });

  it('is idempotent — a second run changes nothing', () => {
    const dir = tempDir();
    installHooks(dir);
    const after1 = readFileSync(join(dir, '.claude', 'settings.json'), 'utf8');
    const result2 = installHooks(dir);
    expect(result2.changed).toEqual([]);
    expect(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).toBe(after1);
  });

  it('preserves existing unrelated settings and hooks', () => {
    const dir = tempDir();
    const claude = join(dir, '.claude');
    mkdirSync(claude, { recursive: true });
    writeFileSync(
      join(claude, 'settings.json'),
      JSON.stringify({
        model: 'opus',
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] },
      }),
    );
    installHooks(dir);
    const settings = JSON.parse(readFileSync(join(claude, 'settings.json'), 'utf8'));
    expect(settings.model).toBe('opus'); // unrelated key preserved
    expect(settings.hooks.Stop).toHaveLength(2); // custom hook + ours
  });
});
