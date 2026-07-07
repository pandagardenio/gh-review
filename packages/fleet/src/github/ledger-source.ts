/**
 * `LedgerFleetSource` (BL-027): the rich tier read live — fetch a repo's
 * `triage/ledger` branch (the file BL-026 writes), parse it, and expose sessions
 * and hook events. A repo without the branch reports `null` (baseline-tier /
 * unknown), never `[]`, keeping "not instrumented" distinct from "instrumented,
 * none". Reads go through the same conditional-request client as the baseline
 * source, so a fleet refresh stays within the rate budget.
 */

import { parseLedger } from '../ledger/read.js';
import type { HookEventRecord, SessionRecord } from '../model/session.js';
import { GitHubApiError, GitHubClient, type GitHubClientOptions } from './client.js';

const LEDGER_PATH = 'contents/ledger.jsonl?ref=triage/ledger';

/** The rich-tier reads a {@link TieredFleetSource} composes over a baseline source. */
export interface RichReader {
  listSessions(repo: string): Promise<SessionRecord[] | null>;
  listHookEvents(repo: string): Promise<HookEventRecord[] | null>;
}

export class LedgerFleetSource implements RichReader {
  readonly #client: GitHubClient;

  constructor(options: GitHubClientOptions) {
    this.#client = new GitHubClient(options);
  }

  async listSessions(repo: string): Promise<SessionRecord[] | null> {
    const text = await this.#fetchLedger(repo);
    return text === null ? null : [...parseLedger(text).sessions];
  }

  async listHookEvents(repo: string): Promise<HookEventRecord[] | null> {
    const text = await this.#fetchLedger(repo);
    return text === null ? null : [...parseLedger(text).hookEvents];
  }

  /** Raw ledger text, or `null` when the repo has no `triage/ledger` branch/file. */
  async #fetchLedger(repo: string): Promise<string | null> {
    try {
      return await this.#client.getRaw(`/repos/${repo}/${LEDGER_PATH}`);
    } catch (error) {
      if (error instanceof GitHubApiError && error.kind === 'not-found') return null;
      throw error;
    }
  }
}
