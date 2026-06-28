import { describe, expect, it } from 'vitest';
import { parsePullRequestUrl } from './coordinates.js';

describe('parsePullRequestUrl', () => {
  it('parses a full PR URL', () => {
    expect(parsePullRequestUrl('https://github.com/octo/repo/pull/42')).toEqual({
      owner: 'octo',
      repo: 'repo',
      number: 42,
    });
  });

  it('parses a bare pathname', () => {
    expect(parsePullRequestUrl('/octo/repo/pull/7')).toEqual({
      owner: 'octo',
      repo: 'repo',
      number: 7,
    });
  });

  it('parses a PR sub-tab URL (e.g. /files)', () => {
    expect(parsePullRequestUrl('https://github.com/octo/repo/pull/9/files')).toEqual({
      owner: 'octo',
      repo: 'repo',
      number: 9,
    });
  });

  it('parses the `.diff` URL itself', () => {
    expect(parsePullRequestUrl('https://github.com/octo/repo/pull/9.diff')).toEqual({
      owner: 'octo',
      repo: 'repo',
      number: 9,
    });
  });

  it('returns null off a non-PR page', () => {
    expect(parsePullRequestUrl('https://github.com/octo/repo/issues/9')).toBeNull();
    expect(parsePullRequestUrl('/octo/repo')).toBeNull();
  });
});
