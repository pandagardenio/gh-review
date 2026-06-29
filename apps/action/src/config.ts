/**
 * Resolve the autoreview policy from a config file and/or action inputs.
 *
 * Precedence (later wins): {@link DEFAULT_POLICY} → JSON config file → explicit
 * `mode` input. The actual validation lives in the engine
 * ({@link parseAutoReviewPolicy}); this module only gathers raw values and hands
 * them over, so the CI surface and any future surface agree on what's valid.
 */

import { type AutoApprovalPolicy, DEFAULT_POLICY, parseAutoReviewPolicy } from '@triage/engine';

/** Reads a file's text, or returns `null` when it does not exist. Injected for tests. */
export type FileReader = (path: string) => string | null;

export interface ActionEnv {
  /** Path to a JSON policy file. Absent file ⇒ ignored (the default may not exist). */
  readonly TRIAGE_CONFIG_FILE?: string;
  /** `auto | never | threshold` input; overrides the config file when non-empty. */
  readonly TRIAGE_MODE?: string;
  /** `maxFiles` for `mode: threshold`, as a string input. */
  readonly TRIAGE_MAX_FILES?: string;
}

export function resolvePolicy(env: ActionEnv, readFile: FileReader): AutoApprovalPolicy {
  let policy: AutoApprovalPolicy = fromConfigFile(env.TRIAGE_CONFIG_FILE, readFile);

  const mode = env.TRIAGE_MODE?.trim();
  if (mode) {
    policy = parseAutoReviewPolicy({ mode, maxFiles: parseMaxFiles(env.TRIAGE_MAX_FILES) });
  }
  return policy;
}

function fromConfigFile(path: string | undefined, readFile: FileReader): AutoApprovalPolicy {
  if (!path) return DEFAULT_POLICY;
  const text = readFile(path);
  if (text === null) return DEFAULT_POLICY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Autoreview config at ${path} is not valid JSON: ${(error as Error).message}`);
  }
  return parseAutoReviewPolicy(parsed);
}

/** Turn the `max-files` string input into a number, or `undefined` when blank. */
function parseMaxFiles(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isNaN(value) ? undefined : value;
}
