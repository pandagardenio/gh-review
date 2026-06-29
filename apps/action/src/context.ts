/**
 * Read the GitHub Actions context this run needs: which PR, on which repo, with
 * what token. Everything comes from the standard env vars and the event payload
 * at `GITHUB_EVENT_PATH`. Throws a clear error if the action is wired onto a
 * non-PR event or without a token, rather than guessing (principle 5).
 */

import type { FileReader } from './config.js';

export interface ActionContext {
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly token: string;
  /** PR author login — used to skip the "can't approve your own PR" case. */
  readonly prAuthor: string;
  /** Head commit SHA — lets us detect a stale prior approval. */
  readonly headSha: string;
}

interface ContextEnv {
  readonly GITHUB_REPOSITORY?: string;
  readonly GITHUB_TOKEN?: string;
  readonly GITHUB_EVENT_PATH?: string;
}

interface PullRequestEvent {
  pull_request?: {
    number?: number;
    head?: { sha?: string };
    user?: { login?: string };
  };
}

export function readActionContext(env: ContextEnv, readFile: FileReader): ActionContext {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error('GITHUB_TOKEN is required (grant pull-requests: write).');

  const repository = env.GITHUB_REPOSITORY;
  if (!repository?.includes('/')) {
    throw new Error(`GITHUB_REPOSITORY must be "owner/repo", got ${JSON.stringify(repository)}.`);
  }
  const [owner, repo] = repository.split('/', 2) as [string, string];

  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath)
    throw new Error('GITHUB_EVENT_PATH is missing — is this running on a pull_request event?');
  const raw = readFile(eventPath);
  if (raw === null) throw new Error(`Event payload not found at ${eventPath}.`);

  const event = JSON.parse(raw) as PullRequestEvent;
  const pr = event.pull_request;
  if (!pr?.number) {
    throw new Error(
      'No pull_request in the event payload — wire this action onto a pull_request event.',
    );
  }

  return {
    owner,
    repo,
    prNumber: pr.number,
    token,
    prAuthor: pr.user?.login ?? '',
    headSha: pr.head?.sha ?? '',
  };
}
