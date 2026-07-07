import { describe, expect, it } from 'vitest';
import { FLEET_VERSION, fleetSmoke } from './smoke.js';

describe('fleetSmoke', () => {
  it('reports the version and a repo count', async () => {
    const result = await fleetSmoke();
    expect(result).toContain(`@triage/fleet ${FLEET_VERSION}`);
    expect(result).toMatch(/repos=\d+/);
  });
});
