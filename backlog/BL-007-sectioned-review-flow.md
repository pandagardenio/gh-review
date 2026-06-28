# BL-007 — Sectioned review flow + viewed state

- **Milestone:** M2
- **Depends on:** BL-005, BL-006
- **Constitution:** Serves principle 1 (review by section/intent, not file order) and
  principle 2 (collapse a reviewed block, never hide it). Strains none.

## Summary

> *As a user I want to review and explore each section independently — both as a block and
> as individual files — using the real code diff, in a flow that fully replaces GitHub's.*

Turn each category (BL-003) into a review **section** with block- and file-level viewed
state and progress, rendered with our own diff (BL-006) (MVP.md §4.2).

## Scope

- Each category from §3 is a review section, collapsible/expandable **independently**.
- **Block level:** a section can be marked reviewed as a whole, and collapsed.
- **Individual level:** each file has its own diff and its own "viewed" state.
- Progress shown per section and overall (e.g. `Config 3/3 · Code 0/40`).
- Viewed state lives in memory here; BL-011 persists it.

## Out of scope

- Persistence/recovery (BL-011), comments (BL-010), tests sub-flow (BL-008/009).

## Acceptance (MVP.md §4.2)

- Every changed file is reachable and reviewable **inside Triage** (no fallback to
  GitHub's "Files changed" tab — that fallback means MVP failure, MVP.md §1).
- Marking a file viewed updates section and overall progress.
- Sections collapse/expand independently.

## Technical notes

- This is the item that proves the MVP goal: the reviewer never leaves Triage to finish.
- Keep viewed state in a serializable shape so BL-011 can persist it without reshaping.
