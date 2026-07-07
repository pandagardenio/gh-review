import { describe, expect, it } from 'vitest';
import { mapCheckRun, mapReviewStates } from './mappers.js';

const run = (status: string, conclusion: string | null) => ({
  name: 'ci',
  status,
  conclusion,
  started_at: null,
  completed_at: null,
});

describe('mapCheckRun', () => {
  it('maps an in-flight check to pending', () => {
    expect(mapCheckRun('r', 's', run('in_progress', null)).conclusion).toBe('pending');
  });

  it('maps startup_failure and stale to failure (never a silent pass)', () => {
    expect(mapCheckRun('r', 's', run('completed', 'startup_failure')).conclusion).toBe('failure');
    expect(mapCheckRun('r', 's', run('completed', 'stale')).conclusion).toBe('failure');
  });

  it('maps a skipped check to neutral (not a failure)', () => {
    expect(mapCheckRun('r', 's', run('completed', 'skipped')).conclusion).toBe('neutral');
  });

  it('maps an unrecognized completed conclusion to failure, not neutral', () => {
    expect(mapCheckRun('r', 's', run('completed', 'some_future_state')).conclusion).toBe('failure');
  });
});

describe('mapReviewStates', () => {
  it('dedupes and lowercases the review states a PR received', () => {
    expect(
      mapReviewStates([
        { state: 'CHANGES_REQUESTED' },
        { state: 'APPROVED' },
        { state: 'CHANGES_REQUESTED' },
        { state: 'PENDING' },
      ]),
    ).toEqual(['changes_requested', 'approved']);
  });
});
