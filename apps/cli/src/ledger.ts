/**
 * Append one record to the repo's `triage/ledger` branch (BL-026), via git
 * plumbing only — the working tree, index, and current branch are never touched.
 *
 * The local `refs/heads/triage/ledger` ref *is* the offline queue: each append
 * advances it and attempts a push; a failed push leaves the record safely on the
 * local ref, and the next append pushes everything pending. A concurrent session
 * that advanced the remote is reconciled by a union merge (append-only logs, so
 * no record is lost) before the new line is added.
 */

import { type LedgerEntry, serializeLedgerLine } from '@triage/fleet';
import { git, gitMaybe, gitRawMaybe } from './git.js';

const LEDGER_BRANCH = 'triage/ledger';
const LEDGER_REF = `refs/heads/${LEDGER_BRANCH}`;
const LEDGER_FILE = 'ledger.jsonl';

export interface AppendOptions {
  readonly cwd: string;
  /** Remote to sync with; `null` disables push (local-only). Defaults to `origin`. */
  readonly remote?: string | null;
}

export interface AppendResult {
  readonly commit: string;
  readonly pushed: boolean;
}

const MAX_ATTEMPTS = 5;

export function appendRecord(entry: LedgerEntry, options: AppendOptions): AppendResult {
  const { cwd } = options;
  const remote = options.remote === undefined ? 'origin' : options.remote;
  const line = serializeLedgerLine(entry);

  // Read → build → compare-and-swap the ref, retrying if another local emit (a
  // concurrent session) moved it in between. Without the expected-old-value on
  // update-ref, a racing append would silently orphan our record.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const localRef = gitRev(cwd, LEDGER_REF);
    let parent = localRef;
    let base = localRef ? blobAt(cwd, `${LEDGER_REF}:${LEDGER_FILE}`) : '';

    if (remote && gitMaybe(['fetch', '--quiet', remote, LEDGER_REF], { cwd }) !== null) {
      const remoteTip = gitRev(cwd, 'FETCH_HEAD');
      if (remoteTip && remoteTip !== parent) {
        parent = remoteTip;
        base = mergeAppendOnly(blobAt(cwd, `${remoteTip}:${LEDGER_FILE}`), base);
      }
    }

    const commit = writeCommit(cwd, parent, `${base}${line}\n`);
    if (!updateRefCas(cwd, commit, localRef)) continue; // ref moved or is locked — retry

    const pushed =
      remote !== null &&
      gitMaybe(['push', '--quiet', remote, `${LEDGER_REF}:${LEDGER_REF}`], { cwd }) !== null;
    return { commit, pushed };
  }
  throw new Error(`ledger: could not update ${LEDGER_REF} after ${MAX_ATTEMPTS} attempts`);
}

/** Compare-and-swap the ledger ref: succeed only if it still equals `oldValue`. */
function updateRefCas(cwd: string, newValue: string, oldValue: string | null): boolean {
  // An empty old value tells git the ref must not currently exist (first write).
  return gitMaybe(['update-ref', LEDGER_REF, newValue, oldValue ?? ''], { cwd }) !== null;
}

function writeCommit(cwd: string, parent: string | null, content: string): string {
  const blob = git(['hash-object', '-w', '--stdin'], { cwd, input: content });
  const tree = git(['mktree'], { cwd, input: `100644 blob ${blob}\t${LEDGER_FILE}\n` });
  const args = ['commit-tree', tree, '-m', 'ledger: append record'];
  if (parent) args.push('-p', parent);
  return git(args, { cwd, identity: true });
}

function gitRev(cwd: string, ref: string): string | null {
  return gitMaybe(['rev-parse', '--quiet', '--verify', ref], { cwd });
}

function blobAt(cwd: string, spec: string): string {
  return gitRawMaybe(['cat-file', '-p', spec], { cwd }) ?? '';
}

/**
 * Union two append-only logs: remote lines first, then the local lines the remote
 * doesn't already have. Records carry unique ids so lines never collide — nothing
 * is dropped, and the merge is deterministic.
 */
export function mergeAppendOnly(remote: string, local: string): string {
  const remoteLines = splitLines(remote);
  const seen = new Set(remoteLines);
  const localOnly = splitLines(local).filter((line) => !seen.has(line));
  const all = [...remoteLines, ...localOnly];
  return all.length > 0 ? `${all.join('\n')}\n` : '';
}

function splitLines(text: string): string[] {
  return text ? text.split('\n').filter((line) => line.length > 0) : [];
}
