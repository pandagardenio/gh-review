/**
 * Baked baseline-tier data for {@link FixtureFleetSource}: three repos, so the
 * cockpit renders a real fleet with zero config and the surfaces test headlessly.
 * `acme/widgets` and `acme/api` are instrumented (rich tier, see `./ledger.ts`);
 * `acme/docs-site` is baseline-only, to prove the "unknown" path renders honestly.
 */

import type { CheckRecord, CommitRecord, PullRecord } from '../model/github.js';
import type { FleetRepo } from '../model/repo.js';

export const FIXTURE_REPOS: readonly FleetRepo[] = [
  { owner: 'acme', name: 'widgets', slug: 'acme/widgets', tiers: ['baseline', 'rich'] },
  { owner: 'acme', name: 'api', slug: 'acme/api', tiers: ['baseline', 'rich'] },
  { owner: 'acme', name: 'docs-site', slug: 'acme/docs-site', tiers: ['baseline'] },
];

const CLAUDE_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>';

export const FIXTURE_COMMITS: Readonly<Record<string, readonly CommitRecord[]>> = {
  'acme/widgets': [
    {
      sha: 'w0a1',
      repo: 'acme/widgets',
      message: `feat: add cursor pagination\n\n${CLAUDE_TRAILER}`,
      authorLogin: 'lead-dev',
      committedAt: '2026-06-20T10:00:00.000Z',
      additions: 180,
      deletions: 12,
    },
    {
      sha: 'w0b2',
      repo: 'acme/widgets',
      message: 'fix: guard null token store',
      authorLogin: 'github-actions[bot]',
      committedAt: '2026-06-22T09:30:00.000Z',
      additions: 14,
      deletions: 3,
    },
    {
      sha: 'w0c3',
      repo: 'acme/widgets',
      message: 'docs: tidy README',
      authorLogin: 'lead-dev',
      committedAt: '2026-06-23T14:15:00.000Z',
      additions: 22,
      deletions: 9,
    },
  ],
  'acme/api': [
    {
      sha: 'a0a1',
      repo: 'acme/api',
      message: `feat: rate-limit headers\n\n${CLAUDE_TRAILER}`,
      authorLogin: 'lead-dev',
      committedAt: '2026-06-21T11:00:00.000Z',
      additions: 240,
      deletions: 30,
    },
    {
      sha: 'a0b2',
      repo: 'acme/api',
      message: `refactor: extract webhook verifier\n\n${CLAUDE_TRAILER}`,
      authorLogin: 'backend-dev',
      committedAt: '2026-06-24T16:40:00.000Z',
      additions: 96,
      deletions: 88,
    },
    {
      sha: 'a0c3',
      repo: 'acme/api',
      message: 'chore: bump deps',
      authorLogin: 'backend-dev',
      committedAt: '2026-06-25T08:05:00.000Z',
      additions: 40,
      deletions: 40,
    },
  ],
  'acme/docs-site': [
    {
      sha: 'd0a1',
      repo: 'acme/docs-site',
      message: `docs: rewrite getting-started\n\n${CLAUDE_TRAILER}`,
      authorLogin: 'writer',
      committedAt: '2026-06-19T13:00:00.000Z',
      additions: 130,
      deletions: 60,
    },
    {
      sha: 'd0b2',
      repo: 'acme/docs-site',
      message: 'docs: fix broken links',
      authorLogin: 'writer',
      committedAt: '2026-06-26T10:20:00.000Z',
      additions: 8,
      deletions: 8,
    },
  ],
};

export const FIXTURE_PULLS: Readonly<Record<string, readonly PullRecord[]>> = {
  'acme/widgets': [
    {
      number: 118,
      repo: 'acme/widgets',
      title: 'Add cursor pagination',
      url: 'https://github.com/acme/widgets/pull/118',
      state: 'merged',
      headSha: 'w0a1',
      headShas: ['w0a1'],
      branch: 'claude/cursor-pagination',
      authorLogin: 'lead-dev',
      createdAt: '2026-06-20T10:05:00.000Z',
      mergedAt: '2026-06-20T18:00:00.000Z',
      additions: 180,
      deletions: 12,
      reviewStates: ['approved'],
    },
    {
      number: 120,
      repo: 'acme/widgets',
      title: 'Tidy README',
      url: 'https://github.com/acme/widgets/pull/120',
      state: 'open',
      headSha: 'w0c3',
      headShas: ['w0c3'],
      branch: 'docs/readme',
      authorLogin: 'lead-dev',
      createdAt: '2026-06-23T14:20:00.000Z',
      mergedAt: null,
      additions: 22,
      deletions: 9,
      reviewStates: [],
    },
  ],
  'acme/api': [
    {
      number: 119,
      repo: 'acme/api',
      title: 'Rate-limit headers',
      url: 'https://github.com/acme/api/pull/119',
      state: 'merged',
      headSha: 'a0a1',
      headShas: ['a0a1'],
      branch: 'claude/rate-limit-headers',
      authorLogin: 'lead-dev',
      createdAt: '2026-06-21T11:10:00.000Z',
      mergedAt: '2026-06-22T09:00:00.000Z',
      additions: 240,
      deletions: 30,
      reviewStates: ['changes_requested', 'approved'],
    },
    {
      number: 122,
      repo: 'acme/api',
      title: 'Extract webhook verifier',
      url: 'https://github.com/acme/api/pull/122',
      state: 'open',
      headSha: 'a0b2',
      headShas: ['a0b2'],
      branch: 'claude/webhook-verifier',
      authorLogin: 'backend-dev',
      createdAt: '2026-06-24T16:45:00.000Z',
      mergedAt: null,
      additions: 96,
      deletions: 88,
      reviewStates: ['changes_requested'],
    },
  ],
  'acme/docs-site': [
    {
      number: 55,
      repo: 'acme/docs-site',
      title: 'Rewrite getting-started',
      url: 'https://github.com/acme/docs-site/pull/55',
      state: 'merged',
      headSha: 'd0a1',
      headShas: ['d0a1'],
      branch: 'claude/getting-started',
      authorLogin: 'writer',
      createdAt: '2026-06-19T13:05:00.000Z',
      mergedAt: '2026-06-19T17:00:00.000Z',
      additions: 130,
      deletions: 60,
      reviewStates: ['approved'],
    },
  ],
};

export const FIXTURE_CHECKS: Readonly<Record<string, readonly CheckRecord[]>> = {
  'acme/widgets': [
    check('acme/widgets', 'w0a1', 'ci', 'success', '2026-06-20T10:10:00.000Z'),
    check('acme/widgets', 'w0c3', 'ci', 'pending', null),
  ],
  'acme/api': [
    check('acme/api', 'a0a1', 'ci', 'failure', '2026-06-21T11:20:00.000Z'),
    check('acme/api', 'a0a1', 'ci', 'success', '2026-06-22T08:40:00.000Z'),
    check('acme/api', 'a0b2', 'ci', 'failure', '2026-06-24T17:00:00.000Z'),
  ],
  'acme/docs-site': [check('acme/docs-site', 'd0a1', 'ci', 'success', '2026-06-19T13:20:00.000Z')],
};

function check(
  repo: string,
  headSha: string,
  name: string,
  conclusion: CheckRecord['conclusion'],
  completedAt: string | null,
): CheckRecord {
  return { repo, headSha, name, conclusion, startedAt: null, completedAt };
}
