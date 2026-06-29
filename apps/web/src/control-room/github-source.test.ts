import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubSource } from './github-source.js';

// Stub the fetch boundary: a router that answers by URL substring. Each handler
// returns the JSON (or raw text, when `Accept: application/vnd.github.raw`) the
// real endpoint would. Anything unmatched 404s, so a method that calls an
// unexpected path fails loudly rather than silently passing.
type Handler = (raw: boolean) => unknown;

function setup(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const accept = String((init?.headers as Record<string, string>)?.Accept ?? '');
    const raw = accept.includes('raw');
    const match = Object.keys(routes).find((key) => url.includes(key));
    const handler = match ? routes[match] : undefined;
    if (!handler) return new Response('not found', { status: 404 });
    const body = handler(raw);
    return new Response(raw ? String(body) : JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const source = new GitHubSource({ owner: 'acme', repo: 'factory', token: 'ghp_x' });
  return { source, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('GitHubSource', () => {
  it('exposes a non-fixture label from owner/repo', () => {
    const { source } = setup({});
    expect(source.label).toBe('acme/factory');
    expect(source.isFixture).toBe(false);
  });

  it('sends the bearer token on every request', async () => {
    const { source, fetchMock } = setup({
      '/issues': () => [],
    });
    await source.listWorkItems();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_x');
  });

  it('lists runs from the ledger tree, coercing and dropping malformed docs', async () => {
    const { source } = setup({
      '/git/trees/factory/ledger': () => ({
        tree: [
          { path: 'runs/0001.json' },
          { path: 'runs/0002.json' },
          { path: 'runs/by-workitem/5.json' }, // index, skipped
          { path: 'README.md' }, // non-run, skipped
        ],
      }),
      'runs/0001.json': () =>
        JSON.stringify({
          id: 'r1',
          workItemId: 5,
          station: 'implement',
          status: 'success',
          startedAt: '2026-06-01T00:00:00Z',
          usage: { wallSeconds: 12, toolCalls: 3 },
          artifacts: { pr: 42 },
        }),
      'runs/0002.json': () => JSON.stringify({ id: 'bad' }), // missing required fields
    });
    const runs = await source.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: 'r1', station: 'implement', pr: 42 });
    expect(runs[0]?.usage.wallSeconds).toBe(12);
  });

  it('maps open issues to work items, deriving stage/priority from labels', async () => {
    const { source } = setup({
      '/issues': () => [
        {
          number: 7,
          title: 'Build the thing',
          html_url: 'https://gh/7',
          labels: [{ name: 'stage:plan' }, { name: 'priority:p1' }],
        },
        { number: 8, title: 'Done thing', labels: [{ name: 'stage:done' }] }, // filtered out
        { number: 9, title: 'A PR', pull_request: {}, labels: [] }, // filtered out
      ],
    });
    const items = await source.listWorkItems();
    expect(items).toEqual([
      { id: 7, title: 'Build the thing', stage: 'plan', priority: 'p1', url: 'https://gh/7' },
    ]);
  });

  it('defaults priority to p2 and stage to queued when labels are absent', async () => {
    const { source } = setup({
      '/issues': () => [{ number: 1, title: 'Bare', labels: [] }],
    });
    const [item] = await source.listWorkItems();
    expect(item?.stage).toBe('queued');
    expect(item?.priority).toBe('p2');
  });

  it('maps open PRs to review items with an escalation reason from labels', async () => {
    const { source } = setup({
      '/pulls': () => [
        {
          number: 10,
          title: 'Escalated PR',
          html_url: 'https://gh/10',
          labels: [{ name: 'escalated' }],
        },
        { number: 11, title: 'QA PR', html_url: 'https://gh/11', labels: [{ name: 'stage:qa' }] },
        { number: 12, title: 'Plain PR', html_url: 'https://gh/12', labels: [] },
      ],
    });
    const reviews = await source.listReviewItems();
    expect(reviews.map((r) => r.reason)).toEqual(['escalated', 'qa', 'open']);
    expect(reviews[0]).toMatchObject({ prNumber: 10, workItemId: 10, url: 'https://gh/10' });
  });

  it('reads and parses the policy file as raw text', async () => {
    const { source } = setup({
      '.factory/policy.yml': () => 'concurrency:\n  maxConcurrency: 4\n',
    });
    const policy = await source.getPolicy();
    expect(policy.maxConcurrency).toBe(4);
    expect(policy.raw).toContain('maxConcurrency: 4');
  });

  it('throws with the status code when a request fails', async () => {
    const { source } = setup({}); // every path 404s
    await expect(source.listWorkItems()).rejects.toThrow(/GitHub 404/);
  });

  it('honours a custom ledger branch', async () => {
    const { fetchMock } = setup({
      '/git/trees/custom/branch': () => ({ tree: [] }),
    });
    const custom = new GitHubSource({
      owner: 'acme',
      repo: 'factory',
      token: 't',
      ledgerBranch: 'custom/branch',
    });
    await custom.listRuns();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/git/trees/custom/branch'),
      expect.anything(),
    );
  });
});
