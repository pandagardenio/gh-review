# @triage/engine

The provider- and UI-agnostic core review engine. Parsing, diff loading,
categorization, the diff model, and the pluggable token-storage contract live
here.

## Hard rule

Nothing reachable from `src/index.ts` may import a UI module or a
browser-extension API (`chrome.*`, `window`, `document`). The engine is pure
logic plus contracts so the **same code runs from both the bookmarklet and the
extension** (BL-001).

## What's here today

- `TokenStore` — pluggable token-storage interface, with an `InMemoryTokenStore`
  default. Persistent implementations (`localStorage`, `chrome.storage`) land
  with their channels.
- `PullRequestDiff` / `DiffFile` — the shared diff model the loader produces and
  the categorizer / renderer / panel consume.
- `engineSmoke()` — proof-of-life that the engine bundles and runs.

Feature logic (loader, categorizer, renderer) arrives in BL-002+.
