import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFleetContext, loadRegistry, type Registry, scaffoldRegistry } from './registry.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'triage-registry-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('scaffoldRegistry', () => {
  it('writes a template on first run and is idempotent after', () => {
    const path = join(dir, 'nested', 'fleet.json');
    const first = scaffoldRegistry(path);
    expect(first.created).toBe(true);
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Registry;
    expect(parsed.repos).toEqual(['owner/repo']);
    expect(parsed.tokenEnv).toBe('GITHUB_TOKEN');

    const second = scaffoldRegistry(path);
    expect(second.created).toBe(false);
  });
});

describe('loadRegistry', () => {
  it('returns null when the file is absent', () => {
    expect(loadRegistry(join(dir, 'missing.json'))).toBeNull();
  });

  it('parses an existing registry', () => {
    const path = join(dir, 'fleet.json');
    writeFileSync(
      path,
      JSON.stringify({ repos: ['acme/widgets'], tokenEnv: 'GH_PAT', windowDays: 14 }),
    );
    const registry = loadRegistry(path);
    expect(registry?.repos).toEqual(['acme/widgets']);
    expect(registry?.windowDays).toBe(14);
  });
});

describe('buildFleetContext', () => {
  const registry: Registry = { repos: ['acme/widgets'], tokenEnv: 'GH_PAT', windowDays: 7 };

  it('reads the token from the named env var and never requires it in the file', async () => {
    const { source, window, tokens } = buildFleetContext(
      registry,
      { GH_PAT: 'ghp_secret' },
      '2026-06-26T12:00:00.000Z',
    );
    expect(source).toBeDefined();
    // the shared token store resolves the value named by tokenEnv
    expect(await tokens.get()).toBe('ghp_secret');
    // window ends at nowIso and spans windowDays
    expect(window.until).toBe('2026-06-26T12:00:00.000Z');
    expect(Date.parse(window.until) - Date.parse(window.since)).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('resolves a null token when the env var is missing (no throw)', async () => {
    const { tokens } = buildFleetContext(registry, {}, '2026-06-26T12:00:00.000Z');
    expect(await tokens.get()).toBeNull();
  });
});
