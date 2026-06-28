# Testing rules

**Stack:** Vitest. `node` environment for the engine (pure logic), `jsdom` for the UI
(DOM construction). No framework test-utils — the codebase is framework-free.

## What to test where

| Kind of code | How to test |
|---|---|
| **Engine** (`packages/engine/src/`) | Pure unit tests, `node` env. Exercise the public contract — parsing, categorization, diff model, the `TokenStore` interface. No DOM, no network: stub the loader's `fetch` boundary. |
| **UI** (`packages/ui/src/`) | `jsdom` env. Build the element via the helper, assert on the produced DOM (`textContent`, `classList`, `style`, attributes) and that listeners fire. Never assert on internal structure you don't care about. |
| **Entry shells** (`apps/*`) | Keep them thin enough to need little testing; what logic exists is exercised through the engine/ui packages they import. |

Shared disposition: exercise the contract, not the implementation.

## File naming & layout

- Tests are co-located: `<name>.test.ts` next to the file under test.
- One top-level `describe` per file. Prefer flat tests with self-describing names over nested `describe`s.
- Keep shared setup in a local `setup()` helper rather than `beforeEach`, so each test reads top-to-bottom.

## Engine test template (node)

```ts
import { describe, expect, it } from 'vitest';
import { InMemoryTokenStore } from './token-store.js';

describe('InMemoryTokenStore', () => {
  it('round-trips set then get', async () => {
    const store = new InMemoryTokenStore();
    await store.set('ghp_example');
    expect(await store.get()).toBe('ghp_example');
  });
});
```

## UI test template (jsdom)

```ts
import { describe, expect, it, vi } from 'vitest';
import { el } from './dom.js';

describe('el', () => {
  it('wires listeners via addEventListener', () => {
    const onClick = vi.fn();
    const node = el('button', { on: { click: onClick } });
    node.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

## CSP-safe DOM assertions

The UI must never inject HTML. Tests are a good place to prove it: assert that text set
via the helper lands in `textContent` (not parsed as markup), e.g. an injected
`<b>` string produces no `<b>` element. The `csp-safe-dom` forbidden-pattern rule blocks
`innerHTML`/`insertAdjacentHTML` at write time; tests are the behavioural backstop.

## Mocking

- Stub at the boundary — the loader's `fetch`, the `TokenStore`. Don't reach through to real network or storage.
- Prefer small fakes (e.g. `InMemoryTokenStore`) over mock frameworks where a hand-written fake is clearer.
- Use `vi.fn()` / `vi.spyOn()` for call assertions; `vi.mock()` only when a module boundary genuinely needs replacing.

## Running

```bash
pnpm test                                  # all suites via turbo
pnpm --filter @triage/engine test          # one package
pnpm --filter @triage/ui test:watch        # watch mode
pnpm exec turbo run test --filter="...[origin/main]"   # only affected (what pre-push runs)
```

## What not to do

- Don't assert on implementation details (internal call counts) unless the behaviour is contractual.
- Don't hit real network or browser storage — stub the boundary.
- Don't snapshot-test DOM output; assert on the specific properties that matter.
- Don't put engine tests in a `jsdom` env — the engine must run headless; a DOM dependency there is a smell that engine isolation has been broken.
