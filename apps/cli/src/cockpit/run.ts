/**
 * Cockpit command runner (BL-028): build a view-model from the registry's live
 * source and print it — as JSON (`--json`, schema-stable for scripting) or an ANSI
 * table. `--watch` re-renders on an interval. Read-only throughout.
 */

import {
  buildFleetView,
  buildRepoView,
  buildSessionsView,
  type FleetSource,
  type ProvenanceWindow,
} from '@triage/fleet';
import { buildFleetContext, loadRegistry, registryPath, scaffoldRegistry } from './registry.js';
import { renderFleet, renderRepo, renderSessions } from './render.js';

export type CockpitCommand = 'fleet' | 'sessions' | 'repo';
export const COCKPIT_COMMANDS: readonly string[] = ['fleet', 'sessions', 'repo'];

export interface ViewOptions {
  readonly json: boolean;
  readonly color: boolean;
  readonly nowMs: number;
  readonly repo?: string;
}

/** Build and serialize a view to its final output string — pure over the source (testable). */
export async function runView(
  command: CockpitCommand,
  source: FleetSource,
  window: ProvenanceWindow,
  options: ViewOptions,
): Promise<string> {
  if (command === 'fleet') {
    const view = await buildFleetView(source, window, options.nowMs);
    return options.json ? stable(view) : renderFleet(view, { color: options.color });
  }
  if (command === 'sessions') {
    const view = await buildSessionsView(source, options.nowMs);
    return options.json ? stable(view) : renderSessions(view, { color: options.color });
  }
  const view = await buildRepoView(source, options.repo ?? '', window, options.nowMs);
  return options.json ? stable(view) : renderRepo(view, { color: options.color });
}

const stable = (value: unknown): string => JSON.stringify(value, null, 2);

/** IO dispatch: scaffold or load the registry, build the live source, print. */
export async function dispatchCockpit(
  command: CockpitCommand | 'init',
  args: readonly string[],
): Promise<number> {
  if (command === 'init') {
    const { path, created } = scaffoldRegistry();
    console.log(
      created
        ? `triage: wrote ${path} — set your repos and the token env var name`
        : `triage: registry already exists at ${path}`,
    );
    return 0;
  }

  const registry = loadRegistry();
  if (!registry) {
    console.error(`triage: no registry at ${registryPath()} — run 'triage init' first`);
    return 1;
  }

  const repo = command === 'repo' ? args.find((arg) => !arg.startsWith('--')) : undefined;
  if (command === 'repo' && !repo) {
    console.error('triage: repo requires an owner/repo argument');
    return 2;
  }

  const { source, window } = buildFleetContext(registry);
  const options: ViewOptions = {
    json: args.includes('--json'),
    color: process.stdout.isTTY === true && !args.includes('--no-color'),
    nowMs: Date.now(),
    repo,
  };

  if (args.includes('--watch')) return watch(command, source, window, options);
  console.log(await runView(command, source, window, options));
  return 0;
}

/** Re-render on an interval, clearing the screen each tick. Never resolves (Ctrl-C exits). */
function watch(
  command: CockpitCommand,
  source: FleetSource,
  window: ProvenanceWindow,
  options: ViewOptions,
): Promise<number> {
  const tick = async (): Promise<void> => {
    const out = await runView(command, source, window, { ...options, nowMs: Date.now() });
    process.stdout.write(`\x1b[2J\x1b[H${out}\n`); // ESC[2J erase screen, ESC[H home cursor
  };
  void tick();
  setInterval(() => void tick(), 15_000);
  return new Promise<number>(() => {});
}
