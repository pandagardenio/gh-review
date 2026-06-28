# BL-008 — Test-case parsing (added / deleted / changed)

- **Milestone:** M3
- **Depends on:** BL-006
- **Constitution:** Serves principle 1 (tests are intent-bearing — surface what behavior
  changed, not just which lines moved). Strains none.

## Summary

> *For tests, I want to preview the test cases changed, added, and deleted.*

For each file in the **Tests** section, parse test-case titles from the patch and classify
each case's status (MVP.md §4.3).

## Scope

- Regex over patch lines for `describe` / `context` / `it` / `test(` titles.
- Classify each case as:
  - **added** — appears in `+` lines,
  - **deleted** — appears in `-` lines,
  - **changed** — title stable, body touched.
- Render the case list with status within the test file's view; clicking a case scrolls to
  it in the rendered diff (BL-006).

## Out of scope

- The implementation-focus jump (BL-009).
- AST / symbol-level resolution — explicitly deferred (MVP.md §2, §4.3 notes).

## Acceptance (MVP.md §4.3)

- Added/deleted/changed cases are listed correctly for a representative spec.
- Clicking a case navigates to it in the rendered diff.

## Technical notes

- Parsing is **heuristic** (regex over patch lines), not a full AST — good enough for MVP
  (MVP.md §4.3 notes). Degrade quietly when a title can't be parsed; never invent cases
  (principle 5).
