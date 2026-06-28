# BL-011 — Draft persistence & recovery

- **Milestone:** M4
- **Depends on:** BL-007, BL-010
- **Constitution:** Serves principle 6 (local-first, user-owned — state lives in the
  browser, no backend) and principle 5 (never silently drop a draft on a head-SHA change).
  Strains none.

## Summary

> *I want to start a review, leave, and recover the content later from localStorage.*

Persist the entire in-progress review as one draft object and restore it on reopen (MVP.md
§4.4).

## Scope

- Single draft object persisted to local storage, keyed by
  `triage:review:{owner}/{repo}#{number}@{headSha}`.
- Draft contains: overall intent (`none` / `approve` / `request-changes` / `comment`),
  per-section and per-file viewed state (BL-007), all draft comments (BL-010), and
  `updatedAt`.
- On reopening the PR, restore the draft automatically.
- If the PR's head SHA changed since save, surface a **non-destructive** notice ("this PR
  has new commits since your draft") and let the reviewer **keep or discard**.
- Persist via the BL-001 storage interface (localStorage impl for the bookmarklet).

## Out of scope

- Rebasing / remapping viewed state and comments onto new commits — deferred (MVP.md §7);
  MVP only surfaces the change.
- Submission (BL-012).

## Acceptance (MVP.md §4.4)

- Closing and reopening the tab restores viewed state and draft comments.
- A head-SHA change is detected and surfaced **without silently dropping work**.

## Technical notes

- The key embeds `@{headSha}`; detect a head-SHA change by comparing the current head to
  the keys/`headSha` of an existing draft — never silently overwrite or discard
  (principle 5).
