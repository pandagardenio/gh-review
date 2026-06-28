import { InMemoryTokenStore } from './token-store.js';

/** Bumped by hand; lets entry shells confirm which engine build they loaded. */
export const ENGINE_VERSION = '0.0.0';

/**
 * Trivial proof-of-life used by the per-target entry shells (and the smoke test)
 * to confirm the engine bundles and runs end to end. Exercises the one piece of
 * real behaviour that exists today — the {@link InMemoryTokenStore} round-trip —
 * without touching the DOM or any extension API.
 */
export async function engineSmoke(): Promise<string> {
  const store = new InMemoryTokenStore();
  await store.set('smoke-token');
  const token = await store.get();
  return `@triage/engine ${ENGINE_VERSION} ok (token=${token})`;
}
