import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, formatPercent } from './format.js';

describe('formatCount', () => {
  it('passes small numbers through and abbreviates large ones', () => {
    expect(formatCount(980)).toBe('980');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(3_400_000)).toBe('3.4M');
  });
});

describe('formatDuration', () => {
  it('scales from seconds to hours', () => {
    expect(formatDuration(8)).toBe('8s');
    expect(formatDuration(200)).toBe('3m 20s');
    expect(formatDuration(180)).toBe('3m');
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('formatPercent', () => {
  it('renders a 0..1 ratio as a whole percent', () => {
    expect(formatPercent(0.923)).toBe('92%');
    expect(formatPercent(1)).toBe('100%');
  });
});
