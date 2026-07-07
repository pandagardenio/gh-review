import { FixtureFleetSource } from '@triage/fleet';
import { describe, expect, it } from 'vitest';
import type { WebTokenStore } from './fleet-registry.js';
import { buildWebFleetContext } from './fleet-source.js';

const NOW_ISO = '2026-06-26T12:00:00.000Z';
const token = (value: string | null): WebTokenStore => ({
  get: async () => value,
  set: async () => {},
  clear: async () => {},
});

describe('buildWebFleetContext', () => {
  it('serves fixtures with no repos configured (the zero-config demo)', () => {
    const ctx = buildWebFleetContext([], token(null), NOW_ISO);
    expect(ctx.isDemo).toBe(true);
    expect(ctx.source).toBeInstanceOf(FixtureFleetSource);
    expect(ctx.window.until).toBe(NOW_ISO);
  });

  it('builds a live tiered source when repos are configured', () => {
    const ctx = buildWebFleetContext(['acme/api', 'acme/web'], token('ghp_x'), NOW_ISO, 14);
    expect(ctx.isDemo).toBe(false);
    expect(ctx.source).not.toBeInstanceOf(FixtureFleetSource);
    // window spans the requested day count, ending at now.
    expect(Date.parse(ctx.window.until) - Date.parse(ctx.window.since)).toBe(
      14 * 24 * 60 * 60 * 1000,
    );
  });
});
