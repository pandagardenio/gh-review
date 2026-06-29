/**
 * Small presentation helpers shared by the views. Pure string formatting —
 * no DOM — so they're trivially testable.
 */

/** Compact a count: 980 → "980", 1500 → "1.5k", 3_400_000 → "3.4M". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1000) return String(Math.round(n));
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Humanize a duration in seconds: 8 → "8s", 200 → "3m 20s", 3900 → "1h 5m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 === 0 ? `${m}m` : `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

/** A 0..1 ratio as a whole-number percent: 0.923 → "92%". */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}
