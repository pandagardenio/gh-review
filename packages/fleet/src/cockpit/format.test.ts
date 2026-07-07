import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, formatPercent, formatScore } from './format.js';

describe('cockpit format helpers', () => {
  it('compacts counts', () => {
    expect(formatCount(980)).toBe('980');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(3_400_000)).toBe('3.4M');
    expect(formatCount(Number.NaN)).toBe('—');
  });

  it('humanizes durations', () => {
    expect(formatDuration(8)).toBe('8s');
    expect(formatDuration(200)).toBe('3m 20s');
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats percents and scores, with — for null/unknown', () => {
    expect(formatPercent(0.923)).toBe('92%');
    expect(formatPercent(null)).toBe('—');
    expect(formatScore(0.82)).toBe('82');
    expect(formatScore(null)).toBe('—');
  });
});
