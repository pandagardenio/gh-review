import { describe, expect, it } from 'vitest';
import type { CommitRecord, PullRecord } from '../model/github.js';
import { classifyCommit, classifyPull, coAuthorTrailers } from './agent-identity.js';

function commit(over: Partial<CommitRecord>): CommitRecord {
  return {
    sha: 'x',
    repo: 'acme/widgets',
    message: 'chore: tidy',
    authorLogin: 'a-person',
    committedAt: '2026-06-20T10:00:00.000Z',
    additions: 10,
    deletions: 2,
    ...over,
  };
}

function pull(over: Partial<PullRecord>): PullRecord {
  return {
    number: 1,
    repo: 'acme/widgets',
    title: 't',
    url: 'u',
    state: 'merged',
    headSha: 'x',
    branch: 'feature/thing',
    authorLogin: 'a-person',
    createdAt: '2026-06-20T10:00:00.000Z',
    mergedAt: '2026-06-20T18:00:00.000Z',
    additions: 10,
    deletions: 2,
    reviewStates: [],
    ...over,
  };
}

describe('classifyCommit', () => {
  it('classifies a Co-Authored-By: Claude trailer as agent', () => {
    const cls = classifyCommit(
      commit({ message: 'feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }),
    );
    expect(cls).toEqual({ provenance: 'agent', agent: 'claude-code' });
  });

  it('is case-insensitive on the trailer key', () => {
    const cls = classifyCommit(
      commit({ message: 'feat: x\n\nco-authored-by: GitHub Copilot <x>' }),
    );
    expect(cls).toEqual({ provenance: 'agent', agent: 'copilot' });
  });

  it('classifies a *[bot] author login as agent under its derived name', () => {
    const cls = classifyCommit(commit({ authorLogin: 'github-actions[bot]' }));
    expect(cls).toEqual({ provenance: 'agent', agent: 'github-actions' });
  });

  it('classifies a plain human commit as human with no agent', () => {
    expect(classifyCommit(commit({}))).toEqual({ provenance: 'human', agent: null });
  });

  it('lets an agent trailer win over the human author (agent wrote it)', () => {
    const cls = classifyCommit(
      commit({ authorLogin: 'a-person', message: 'feat\n\nCo-Authored-By: Claude <x>' }),
    );
    expect(cls.provenance).toBe('agent');
  });

  it('outputs only provenance + agent — no person field', () => {
    const cls = classifyCommit(commit({ authorLogin: 'someone' }));
    expect(Object.keys(cls).sort()).toEqual(['agent', 'provenance']);
  });
});

describe('classifyPull', () => {
  it('classifies an agent branch prefix as agent', () => {
    expect(classifyPull(pull({ branch: 'claude/cursor-pagination' }))).toEqual({
      provenance: 'agent',
      agent: 'claude-code',
    });
  });

  it('classifies a human branch as human', () => {
    expect(classifyPull(pull({ branch: 'feature/manual' }))).toEqual({
      provenance: 'human',
      agent: null,
    });
  });

  it('falls back to a bot author login when the branch is not prefixed', () => {
    expect(classifyPull(pull({ branch: 'main', authorLogin: 'copilot[bot]' })).provenance).toBe(
      'agent',
    );
  });

  it('treats a null branch as no signal', () => {
    expect(classifyPull(pull({ branch: null, authorLogin: 'a-person' })).provenance).toBe('human');
  });
});

describe('coAuthorTrailers', () => {
  it('extracts and lowercases every trailer value', () => {
    const msg = 'feat\n\nCo-Authored-By: Alice <a@x>\nCo-authored-by: Claude <c@x>';
    expect(coAuthorTrailers(msg)).toEqual(['alice <a@x>', 'claude <c@x>']);
  });

  it('returns nothing when there is no trailer', () => {
    expect(coAuthorTrailers('just a subject')).toEqual([]);
  });
});
