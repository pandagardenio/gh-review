/**
 * `triage install-hooks` (BL-026): wire the emitter into a repo's
 * `.claude/settings.json` so sessions and hook friction land on the ledger.
 * Idempotent — running it twice leaves the same config as running it once.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface HookCommand {
  readonly type: 'command';
  readonly command: string;
}
interface HookMatcher {
  readonly matcher?: string;
  readonly hooks: HookCommand[];
}
interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

/** The emitter wiring: session lifecycle + a throttled per-tool heartbeat. */
const HOOK_ENTRIES: ReadonlyArray<{ event: string; command: string }> = [
  { event: 'SessionStart', command: 'triage emit session-start' },
  { event: 'Stop', command: 'triage emit session-end' },
  { event: 'PostToolUse', command: 'triage emit heartbeat' },
];

export interface InstallResult {
  readonly path: string;
  readonly changed: string[];
}

export function installHooks(cwd: string): InstallResult {
  const path = join(cwd, '.claude', 'settings.json');
  const settings: Settings = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Settings)
    : {};
  const hooks: Record<string, HookMatcher[]> = settings.hooks ?? {};
  settings.hooks = hooks;

  const changed: string[] = [];
  for (const { event, command } of HOOK_ENTRIES) {
    const matchers = hooks[event] ?? [];
    hooks[event] = matchers;
    if (matchers.some((matcher) => matcher.hooks?.some((hook) => hook.command === command))) {
      continue;
    }
    matchers.push({ hooks: [{ type: 'command', command }] });
    changed.push(event);
  }

  if (changed.length > 0) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
  }
  return { path, changed };
}
