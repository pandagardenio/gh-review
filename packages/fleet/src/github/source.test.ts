import { describe, expect, it } from 'vitest';
import { classifyCommit } from '../provenance/agent-identity.js';
import { GitHubFleetSource } from './source.js';

const tokens = { get: async () => 'ghp_token', set: async () => {}, clear: async () => {} };
const WINDOW = { since: '2026-06-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' };

function res(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response;
}

// A fetch router keyed by URL substring, so each endpoint returns canned JSON.
function router(
  routes: Array<{ match: string; body: unknown; status?: number }>,
): typeof globalThis.fetch {
  return (async (url: string) => {
    for (const route of routes) {
      if (url.includes(route.match)) return res(route.body, route.status);
    }
    return res([], 200);
  }) as unknown as typeof globalThis.fetch;
}

const COMMITS = [
  {
    sha: 'c1',
    commit: {
      message: 'feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
      committer: { date: '2026-06-10T10:00:00.000Z' },
    },
    author: { login: 'lead-dev' },
  },
];
const PULLS = [
  {
    number: 7,
    title: 'A',
    html_url: 'u7',
    state: 'closed',
    merged_at: '2026-06-12T00:00:00.000Z',
    created_at: '2026-06-11T00:00:00.000Z',
    head: { sha: 'h7', ref: 'claude/x' },
    user: { login: 'lead-dev' },
  },
  {
    number: 2,
    title: 'old',
    html_url: 'u2',
    state: 'closed',
    merged_at: '2026-01-02T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    head: { sha: 'h2', ref: 'feature/y' },
    user: { login: 'dev' },
  },
];

function makeSource(fetch: typeof globalThis.fetch, repos = ['acme/widgets']) {
  return new GitHubFleetSource({ tokens, fetch, repos, window: WINDOW });
}

describe('GitHubFleetSource', () => {
  it('maps windowed commits (classifiable downstream)', async () => {
    const source = makeSource(router([{ match: '/commits?', body: COMMITS }]));
    const commits = await source.listCommits('acme/widgets');
    expect(commits).toHaveLength(1);
    const first = commits[0];
    expect(first?.message).toContain('Co-Authored-By');
    expect(first && classifyCommit(first).agent).toBe('claude-code');
  });

  it('filters PRs to the window and attaches review states', async () => {
    const source = makeSource(
      router([
        { match: '/pulls?', body: PULLS },
        {
          match: '/pulls/7/reviews',
          body: [{ state: 'CHANGES_REQUESTED' }, { state: 'APPROVED' }],
        },
      ]),
    );
    const pulls = await source.listPulls('acme/widgets');
    expect(pulls.map((p) => p.number)).toEqual([7]); // #2 is outside the window
    expect(pulls[0]?.reviewStates).toEqual(['changes_requested', 'approved']);
    expect(pulls[0]?.state).toBe('merged');
  });

  it('fetches check runs per PR head SHA', async () => {
    const source = makeSource(
      router([
        { match: '/pulls?', body: [PULLS[0]] },
        { match: '/pulls/7/reviews', body: [] },
        {
          match: '/commits/h7/check-runs',
          body: {
            check_runs: [
              {
                name: 'ci',
                status: 'completed',
                conclusion: 'failure',
                started_at: null,
                completed_at: '2026-06-12T01:00:00.000Z',
              },
            ],
          },
        },
      ]),
    );
    const checks = await source.listChecks('acme/widgets');
    expect(checks).toEqual([
      {
        repo: 'acme/widgets',
        headSha: 'h7',
        name: 'ci',
        conclusion: 'failure',
        startedAt: null,
        completedAt: '2026-06-12T01:00:00.000Z',
      },
    ]);
  });

  it('returns null for rich-tier reads (not this source’s job)', async () => {
    const source = makeSource(router([]));
    expect(await source.listSessions()).toBeNull();
    expect(await source.listHookEvents()).toBeNull();
  });

  it('loadFleet isolates a broken repo — others still load', async () => {
    const fetch = (async (url: string) => {
      if (url.includes('acme/broken')) return res({ message: 'Not Found' }, 404);
      if (url.includes('/commits?')) return res(COMMITS);
      if (url.includes('/pulls?')) return res([]);
      return res([]);
    }) as unknown as typeof globalThis.fetch;
    const source = makeSource(fetch, ['acme/widgets', 'acme/broken']);

    const refresh = await source.loadFleet();
    expect(refresh.total).toBe(2);
    expect(refresh.refreshed).toBe(1);
    const broken = refresh.loads.find((l) => l.repo === 'acme/broken');
    expect(broken).toMatchObject({ ok: false, kind: 'not-found' });
    const ok = refresh.loads.find((l) => l.repo === 'acme/widgets');
    expect(ok?.ok).toBe(true);
  });

  it('advertises itself as a live (non-fixture) source', async () => {
    const source = makeSource(router([]), ['a/b', 'c/d']);
    expect(source.isFixture).toBe(false);
    expect(source.label).toBe('2 repos');
    expect((await source.listRepos()).every((r) => r.tiers.includes('baseline'))).toBe(true);
  });
});
