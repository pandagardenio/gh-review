/**
 * Fleet registry (BL-028): the cockpit's config at `~/.config/triage/fleet.json`
 * — the repo list plus the *name* of the env var holding the token (never the
 * token itself). `triage init` scaffolds it; the cockpit commands read it and
 * build a live {@link TieredFleetSource} (baseline REST + rich ledger, one shared
 * conditional-request cache to honour the rate budget).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  type FleetSource,
  GitHubFleetSource,
  InMemoryConditionalCache,
  LedgerFleetSource,
  type ProvenanceWindow,
  TieredFleetSource,
  windowEndingAt,
} from '@triage/fleet';

export interface Registry {
  readonly repos: string[];
  /** Env var name holding the GitHub token — the token never lands in this file. */
  readonly tokenEnv: string;
  readonly windowDays?: number;
}

export function registryPath(): string {
  return join(homedir(), '.config', 'triage', 'fleet.json');
}

export function loadRegistry(path: string = registryPath()): Registry | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Registry;
}

export function scaffoldRegistry(path: string = registryPath()): {
  path: string;
  created: boolean;
} {
  if (existsSync(path)) return { path, created: false };
  mkdirSync(dirname(path), { recursive: true });
  const template: Registry = { repos: ['owner/repo'], tokenEnv: 'GITHUB_TOKEN', windowDays: 30 };
  writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`);
  return { path, created: true };
}

export interface FleetContext {
  readonly source: FleetSource;
  readonly window: ProvenanceWindow;
  /** The token store both tiers share — resolves the value named by `tokenEnv`, or null. */
  readonly tokens: { get(): Promise<string | null> };
}

/** Build the live tiered source + metrics window from a registry. */
export function buildFleetContext(
  registry: Registry,
  env: NodeJS.ProcessEnv = process.env,
  nowIso: string = new Date().toISOString(),
): FleetContext {
  const token = env[registry.tokenEnv] ?? null;
  const tokens = { get: async () => token, set: async () => {}, clear: async () => {} };
  const cache = new InMemoryConditionalCache();
  const window = windowEndingAt(nowIso, registry.windowDays ?? 30);
  const baseline = new GitHubFleetSource({ repos: registry.repos, tokens, window, cache });
  const rich = new LedgerFleetSource({ tokens, cache });
  return { source: new TieredFleetSource(baseline, rich), window, tokens };
}
