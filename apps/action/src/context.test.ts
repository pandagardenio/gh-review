import { describe, expect, it } from 'vitest';
import { readActionContext } from './context.js';

const event = JSON.stringify({
  pull_request: { number: 42, head: { sha: 'abc123' }, user: { login: 'octocat' } },
});

const baseEnv = {
  GITHUB_TOKEN: 'ghs_token',
  GITHUB_REPOSITORY: 'pandagardenio/gh-review',
  GITHUB_EVENT_PATH: '/event.json',
};

describe('readActionContext', () => {
  it('reads owner, repo, PR number, author and head sha', () => {
    const ctx = readActionContext(baseEnv, () => event);
    expect(ctx).toEqual({
      owner: 'pandagardenio',
      repo: 'gh-review',
      prNumber: 42,
      token: 'ghs_token',
      prAuthor: 'octocat',
      headSha: 'abc123',
    });
  });

  it('throws without a token', () => {
    expect(() => readActionContext({ ...baseEnv, GITHUB_TOKEN: '' }, () => event)).toThrow(
      /GITHUB_TOKEN/,
    );
  });

  it('throws on a malformed repository', () => {
    expect(() => readActionContext({ ...baseEnv, GITHUB_REPOSITORY: 'nope' }, () => event)).toThrow(
      /owner\/repo/,
    );
  });

  it('throws when the event is not a pull request', () => {
    expect(() => readActionContext(baseEnv, () => JSON.stringify({}))).toThrow(/pull_request/);
  });
});
