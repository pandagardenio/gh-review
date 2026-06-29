import { describe, expect, it } from 'vitest';
import type { ReviewItem } from '../source.js';
import { reviewPane } from './review.js';

function item(overrides: Partial<ReviewItem>): ReviewItem {
  return {
    workItemId: 42,
    prNumber: 119,
    title: 'Add rate-limit headers',
    url: 'https://github.com/o/r/pull/119',
    reason: 'qa',
    gatedPaths: [],
    ...overrides,
  };
}

describe('reviewPane', () => {
  it('renders a real external link when the PR has a url', () => {
    const pane = reviewPane([item({})]);
    const link = pane.querySelector('a.cr-review__cta');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://github.com/o/r/pull/119');
  });

  it('renders a muted placeholder instead of a dead link when url is empty', () => {
    const pane = reviewPane([item({ url: '' })]);
    expect(pane.querySelector('a.cr-review__cta')).toBeNull();
    const placeholder = pane.querySelector('.cr-review__cta--missing');
    expect(placeholder?.textContent).toBe('No PR link');
  });

  it('shows the empty state when nothing is awaiting review', () => {
    const pane = reviewPane([]);
    expect(pane.querySelector('.cr-empty')?.textContent).toContain('queue is clear');
  });
});
