import { describe, expect, it } from 'vitest';
import { STATION_ORDER } from './source.js';

describe('source re-exports', () => {
  it('re-exports the factory station order from @triage/fleet (single boundary)', () => {
    // The factory Run model lives in @triage/fleet (BL-029); source.ts is the app's
    // one import boundary for it. A runtime value round-trips through the re-export.
    expect(STATION_ORDER).toContain('implement');
    expect(STATION_ORDER[0]).toBe('intake');
  });
});
