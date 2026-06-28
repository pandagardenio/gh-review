import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, engineSmoke } from './smoke.js';

describe('engineSmoke', () => {
  it('runs the engine end to end without a DOM or extension API', async () => {
    expect(await engineSmoke()).toBe(`@triage/engine ${ENGINE_VERSION} ok (token=smoke-token)`);
  });
});
