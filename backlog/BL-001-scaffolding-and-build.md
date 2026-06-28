# BL-001 — Project scaffolding & build split

- **Milestone:** M1
- **Depends on:** —
- **Constitution:** Serves principle 6 (local-first, no backend) and principle 5
  (robustness — a clean engine/UI split is what lets us test the risky parts in isolation).
  Strains none.

## Summary

Stand up the repository structure, build tooling, and conventions so that the **core
review engine is provider-agnostic and UI-agnostic** and the same engine code runs from
both the bookmarklet and the extension (per CLAUDE.md "Your call: scaffolding").

## Scope

- Establish the source split: **engine** (parsing, loading, categorization, diff model) /
  **UI** (DOM construction) / **thin per-target entry shells** (bookmarklet, extension).
- Pick and configure the bundler/toolchain (TypeScript recommended; decide and document).
- Bundler produces, from one core:
  - a single self-contained bundle suitable for inlining (feeds BL-013), and
  - a **content-hashed** bundle + a `manifest.json` (feeds BL-014/BL-015).
- **Pluggable token storage interface** — one abstraction with two implementations later
  (`localStorage` for bookmarklet, `chrome.storage` for extension). Define the interface
  here; implementations land with their channels.
- Lint/format config and a test runner wired so engine logic is unit-testable headless.
- A trivial smoke entry that proves the engine bundles and runs.

## Out of scope

- Any actual feature logic (loader, categorizer, renderer) — those are their own items.
- The extension manifest and bookmarklet bundling specifics (BL-013, BL-014).

## Acceptance

- Engine modules have **zero** imports from UI or any browser-extension API.
- `npm run build` (or chosen equivalent) emits both the inlinable bundle and the
  hashed-bundle + `manifest.json` outputs.
- Engine unit tests run headless in CI.
- A token-storage interface exists with a documented contract; no concrete storage is
  hardwired into the engine.

## Technical notes

- **Do not** build a github.com remote-loader: CSP forbids remote code on github.com
  (MVP.md §5.2). The hashed-bundle/manifest output exists for the **extension** path only.
- Keep CSP-safe DOM conventions as a documented rule for the UI layer: `createElement` +
  CSSOM (`element.style`) + `addEventListener`; never `innerHTML` with inline
  `style=`/`on*` (MVP.md §6, CLAUDE.md).
