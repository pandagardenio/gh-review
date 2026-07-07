/**
 * A thin, synchronous `git` runner for the ledger emitter (BL-026). All ledger
 * writes go through git *plumbing* (`hash-object` / `mktree` / `commit-tree` /
 * `update-ref`) so they touch only the object database and one ref — never the
 * working tree, the index, or the current branch.
 */

import { execFileSync } from 'node:child_process';

/** A machine identity for ledger commits — never the developer's (principle 1). */
const LEDGER_IDENTITY = {
  GIT_AUTHOR_NAME: 'triage-emitter',
  GIT_AUTHOR_EMAIL: 'triage-emitter@localhost',
  GIT_COMMITTER_NAME: 'triage-emitter',
  GIT_COMMITTER_EMAIL: 'triage-emitter@localhost',
};

export interface GitOptions {
  readonly cwd: string;
  readonly input?: string;
  /** Stamp the ledger machine identity onto the command (for commit-tree). */
  readonly identity?: boolean;
}

/** Run git, returning trimmed stdout. Throws on a nonzero exit. */
export function git(args: readonly string[], options: GitOptions): string {
  const env = options.identity ? { ...process.env, ...LEDGER_IDENTITY } : process.env;
  return execFileSync('git', args as string[], {
    cwd: options.cwd,
    input: options.input,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/** Run git, returning null on any nonzero exit — for best-effort "maybe" queries. */
export function gitMaybe(args: readonly string[], options: GitOptions): string | null {
  try {
    return git(args, options);
  } catch {
    return null;
  }
}

/**
 * Run git returning **untrimmed** stdout (null on nonzero exit). Use for reading
 * file content, where a trailing newline is significant — trimming it would fuse
 * the last ledger line into the next append.
 */
export function gitRawMaybe(args: readonly string[], options: GitOptions): string | null {
  try {
    return execFileSync('git', args as string[], {
      cwd: options.cwd,
      input: options.input,
      env: process.env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}
