# BL-005 — Triage panel (categorized navigator)

- **Milestone:** M1
- **Depends on:** BL-003 (and BL-004 for dependency rows)
- **Constitution:** Serves principle 1 (move attention to where risk concentrates) and
  principle 2 (de-emphasize, never hide — Code is collapsed, never removed). Strains none;
  the explicit collapse-not-hide design is the principle-2 safeguard.

## Summary

The categorized navigator and entry point: per-category sections with file counts and
churn, inline dependency changes, and jump-to-file via GitHub's native anchors. This is
the launcher for the M2 review flow (MVP.md §4.1).

## Scope

- Inject a CSP-safe panel (`createElement` + CSSOM + `addEventListener`).
- Render each category section with file count and churn (additions/deletions).
- **Code section collapsed by default**; all others visible; everything reachable.
- Inline dependency rows in the Dependencies section (from BL-004).
- Clicking a file jumps the native view to it via `#diff-<sha256(path)>` (computed with
  `crypto.subtle`; setting `location.hash` scrolls the virtualized native view).

## Out of scope

- Our own diff rendering and viewed/progress state — those are M2 (BL-006, BL-007).

## Acceptance (MVP.md §4.1)

- Opens on any PR, groups **all** changed files correctly.
- **Code collapsed by default.**
- Clicking a file scrolls the native diff to it.

## Technical notes

- Anchor hash is `#diff-<sha256(filepath)>` in hex (MVP.md §6).
- No `innerHTML` carrying inline `style=`/`on*`; CSP on github.com forbids it (MVP.md §6).
- A working bookmarklet prototype is the behavioural reference for this panel — treat it as
  the spec for output, not code to preserve verbatim (CLAUDE.md).
