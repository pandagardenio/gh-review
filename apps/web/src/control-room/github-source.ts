/**
 * A {@link FactorySource} over a live dark-factory repo.
 *
 * Reads are best-effort and defensive — a malformed ledger file is skipped, not
 * fatal. Auth is a GitHub token (same model Triage uses: `api.github.com`
 * CORS-allows `Authorization` from a browser). No writes: editing policy or
 * landing a review happens through GitHub / Triage, never from here.
 */

import { parsePolicy } from './policy.js';
import type {
  FactorySource,
  PolicySummary,
  Priority,
  ReviewItem,
  ReviewReason,
  RunRecord,
  RunStatus,
  Stage,
  Station,
  WorkItem,
} from './source.js';

const API = 'https://api.github.com';
const STATIONS: readonly Station[] = [
  'intake',
  'spec',
  'plan',
  'implement',
  'qa',
  'integrate',
  'deploy',
];
const RUN_STATUSES: readonly RunStatus[] = ['running', 'success', 'failure', 'escalated'];
const MAX_RUNS = 200;

export interface GitHubSourceOptions {
  readonly owner: string;
  readonly repo: string;
  readonly token: string;
  readonly ledgerBranch?: string;
}

const asObject = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;

function labelNames(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.map((l) => asString(asObject(l).name) ?? '').filter(Boolean);
}

function stageOf(labels: readonly string[]): Stage {
  const tag = labels.find((l) => l.startsWith('stage:'))?.slice('stage:'.length);
  return (tag as Stage) ?? 'queued';
}

function priorityOf(labels: readonly string[]): Priority {
  const tag = labels.find((l) => l.startsWith('priority:'))?.slice('priority:'.length);
  return (oneOf(tag, ['p0', 'p1', 'p2', 'p3'] as const) ?? 'p2') as Priority;
}

function reviewReasonOf(labels: readonly string[]): ReviewReason {
  if (labels.includes('escalated') || labels.includes('needs-human')) return 'escalated';
  if (labels.includes('stage:escalated')) return 'escalated';
  if (labels.includes('stage:qa')) return 'qa';
  return 'open';
}

function coerceRun(value: unknown): RunRecord | null {
  const o = asObject(value);
  const id = asString(o.id);
  const station = oneOf(o.station, STATIONS);
  const status = oneOf(o.status, RUN_STATUSES);
  const workItemId = asNumber(o.workItemId);
  if (!id || !station || !status || workItemId === null) return null;
  const usage = asObject(o.usage);
  const artifacts = asObject(o.artifacts);
  return {
    id,
    workItemId,
    station,
    status,
    startedAt: asString(o.startedAt) ?? '',
    endedAt: asString(o.endedAt),
    failureReason: asString(o.failureReason),
    usage: {
      tokensIn: asNumber(usage.tokensIn),
      tokensOut: asNumber(usage.tokensOut),
      wallSeconds: asNumber(usage.wallSeconds) ?? 0,
      toolCalls: asNumber(usage.toolCalls) ?? 0,
    },
    pr: asNumber(artifacts.pr),
  };
}

export class GitHubSource implements FactorySource {
  readonly label: string;
  readonly isFixture = false;
  readonly #owner: string;
  readonly #repo: string;
  readonly #token: string;
  readonly #ledgerBranch: string;

  constructor(opts: GitHubSourceOptions) {
    this.#owner = opts.owner;
    this.#repo = opts.repo;
    this.#token = opts.token;
    this.#ledgerBranch = opts.ledgerBranch ?? 'factory/ledger';
    this.label = `${opts.owner}/${opts.repo}`;
  }

  async #get(path: string, raw = false): Promise<unknown> {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
    return raw ? res.text() : res.json();
  }

  async listRuns(): Promise<RunRecord[]> {
    const repo = `${this.#owner}/${this.#repo}`;
    const tree = asObject(
      await this.#get(`/repos/${repo}/git/trees/${this.#ledgerBranch}?recursive=1`),
    );
    const entries = Array.isArray(tree.tree) ? tree.tree : [];
    const paths = entries
      .map((e) => asString(asObject(e).path) ?? '')
      .filter((p) => p.startsWith('runs/') && p.endsWith('.json') && !p.includes('by-workitem'))
      .sort((a, b) => a.localeCompare(b))
      .slice(-MAX_RUNS);
    const docs = await Promise.all(
      paths.map((p) =>
        this.#get(`/repos/${repo}/contents/${p}?ref=${this.#ledgerBranch}`, true)
          .then((text) => coerceRun(JSON.parse(asString(text) ?? 'null')))
          .catch(() => null),
      ),
    );
    return docs.filter((d): d is RunRecord => d !== null);
  }

  async listWorkItems(): Promise<WorkItem[]> {
    const repo = `${this.#owner}/${this.#repo}`;
    const issues = await this.#get(`/repos/${repo}/issues?state=open&per_page=100`);
    const list = Array.isArray(issues) ? issues : [];
    return list
      .filter((i) => asObject(i).pull_request === undefined)
      .map((i) => {
        const o = asObject(i);
        const labels = labelNames(o.labels);
        return {
          id: asNumber(o.number) ?? 0,
          title: asString(o.title) ?? '(untitled)',
          stage: stageOf(labels),
          priority: priorityOf(labels),
          url: asString(o.html_url) ?? '',
        };
      })
      .filter((w) => w.stage !== 'done' && w.stage !== 'rejected');
  }

  async listReviewItems(): Promise<ReviewItem[]> {
    const repo = `${this.#owner}/${this.#repo}`;
    const prs = await this.#get(`/repos/${repo}/pulls?state=open&per_page=50`);
    const list = Array.isArray(prs) ? prs : [];
    return list.map((p) => {
      const o = asObject(p);
      const labels = labelNames(o.labels);
      return {
        workItemId: asNumber(o.number) ?? 0,
        prNumber: asNumber(o.number) ?? 0,
        title: asString(o.title) ?? '(untitled)',
        url: asString(o.html_url) ?? '',
        reason: reviewReasonOf(labels),
        gatedPaths: [],
      };
    });
  }

  async getPolicy(): Promise<PolicySummary> {
    const repo = `${this.#owner}/${this.#repo}`;
    const raw =
      asString(await this.#get(`/repos/${repo}/contents/.factory/policy.yml`, true)) ?? '';
    return parsePolicy(raw);
  }
}
