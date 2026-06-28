# BL-006 — Unified diff renderer

- **Milestone:** M2
- **Depends on:** BL-002
- **Constitution:** Serves principle 3 (augment, don't replace — we render the diff so the
  review lives in our surface, but the change still belongs to GitHub) and principle 5
  (graceful degradation for patchless files). Strains none.

## Summary

Render a unified diff per file from its `patch`, inside Triage's surface. We render the
diff ourselves because GitHub's new diff view is virtualized and cannot be relied upon
(MVP.md §4.2).

## Scope

- Parse a file `patch` into hunks: added / removed / context lines with correct **old and
  new line numbers**.
- Render a unified (single-column) monospace diff per file, CSP-safe.
- **Binary / patch-less files:** show a clear "no inline diff — open on GitHub"
  affordance rather than an empty or broken view.
- Lazy render per file so large PRs don't recreate the perf problem virtualization solved
  (MVP.md §7).

## Out of scope

- Syntax highlighting (explicitly deferred, MVP.md §2).
- Inline comments (BL-010), viewed state / sections (BL-007).
- Split/side-by-side view.

## Acceptance (MVP.md §4.2)

- Rendered diff **matches GitHub's content** for the file.
- Hunks and line numbers are correct.
- Absent patches **degrade gracefully** (binary/patchless affordance shown).

## Technical notes

- Line + side correctness here is the substrate for comment anchoring (BL-010) and the
  riskiest integration in the MVP (MVP.md §7) — get old/new line numbers right per row,
  per side (LEFT/RIGHT).
- Plain monospace is acceptable for v1 (MVP.md §2).
