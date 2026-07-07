/**
 * `triage` CLI entry (BL-026 emitter, BL-028 cockpit). A thin dispatch + arg/stdin
 * parse over `emit`/`installHooks` (the ledger-writing face) and `dispatchCockpit`
 * (the read-only cockpit: `init`, `fleet`, `sessions`, `repo`). All real logic lives
 * in those modules and in `@triage/fleet`. An emit hiccup must never break a session,
 * so every emit path returns exit 0.
 */

import { readFileSync } from 'node:fs';
import type { HookOutcome, SessionStatus } from '@triage/fleet';
import { COCKPIT_COMMANDS, type CockpitCommand, dispatchCockpit } from './cockpit/run.js';
import { type EmitKind, emit } from './emit.js';
import { installHooks } from './install-hooks.js';

const EMIT_KINDS: readonly EmitKind[] = ['session-start', 'session-end', 'heartbeat', 'hook-event'];
const SESSION_STATUSES: readonly string[] = ['running', 'success', 'failure', 'escalated'];

function parseFlags(args: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith('--')) continue;
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[arg.slice(2)] = next;
      i++;
    } else {
      flags[arg.slice(2)] = 'true';
    }
  }
  return flags;
}

function readPayload(): Record<string, unknown> {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

async function main(argv: readonly string[]): Promise<number> {
  const [command, sub, ...rest] = argv;

  if (command === 'init' || COCKPIT_COMMANDS.includes(command ?? '')) {
    return dispatchCockpit(command as CockpitCommand | 'init', argv.slice(1));
  }

  if (command === 'install-hooks') {
    const { changed, path } = installHooks(process.cwd());
    console.log(
      changed.length > 0
        ? `triage: wired ${changed.join(', ')} in ${path}`
        : `triage: hooks already installed in ${path}`,
    );
    return 0;
  }

  if (command === 'emit') {
    if (!EMIT_KINDS.includes(sub as EmitKind)) {
      console.error(
        `triage: unknown emit kind '${sub ?? ''}' (expected ${EMIT_KINDS.join(' | ')})`,
      );
      return 2;
    }
    const kind = sub as EmitKind;
    const flags = parseFlags(rest);
    const payload = readPayload();
    const status =
      flags.status && SESSION_STATUSES.includes(flags.status) ? flags.status : undefined;

    const result = emit(kind, {
      cwd: process.cwd(),
      sessionId: flags['session-id'] ?? asString(payload.session_id) ?? 'unknown',
      remote: flags.remote === 'none' ? null : flags.remote,
      session:
        kind === 'session-end'
          ? { status: status as SessionStatus | undefined, failureReason: flags['failure-reason'] }
          : undefined,
      hook:
        kind === 'hook-event'
          ? {
              hook: flags.hook ?? asString(payload.hook_event_name) ?? 'unknown',
              outcome: (flags.outcome as HookOutcome) ?? 'block',
              ruleId: flags['rule-id'],
            }
          : undefined,
    });
    if (!result.emitted && result.reason) console.error(`triage: skipped (${result.reason})`);
    return 0; // never block the session on an emitter problem
  }

  console.error(
    'usage: triage <init | fleet | sessions | repo <owner/repo> | ' +
      'emit session-start|session-end|heartbeat|hook-event | install-hooks>',
  );
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`triage: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
