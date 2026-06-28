# BL-012 — Review materialization (submit to GitHub)

- **Milestone:** M4
- **Depends on:** BL-010, BL-011
- **Constitution:** Serves principle 3 (the verdict lands in GitHub's trust primitives; we
  are never the system of record) and principle 4 (the human chooses approve / request
  changes / comment — the tool never auto-approves). Strains none — this is the safeguard
  for both.

## Summary

> *The review is materialized in the PR once it ends (approve or request changes).*

"Finish review" submits the accumulated draft as **one** GitHub review (MVP.md §4.5).

## Scope

- `POST /repos/{owner}/{repo}/pulls/{number}/reviews` with:
  - `commit_id` = head SHA,
  - `event` ∈ `APPROVE | REQUEST_CHANGES | COMMENT`,
  - optional `body`,
  - draft `comments[]` (`path`, `line`, `side`, `body`).
- On success: clear the local draft (BL-011) and reflect the submitted state in the panel.
- On failure (auth / conflict / validation): **lose nothing** — draft remains, error shown
  plainly.

## Out of scope

- Auto-selecting the event — the reviewer always chooses (principle 4).
- Re-review / threaded replies after submission.

## Acceptance (MVP.md §4.5)

- Submitting produces **exactly one** review on the PR carrying all comments and the chosen
  event.
- A failed submission leaves the local draft intact.

## Technical notes

- Uses the BL-001 token-storage interface for `Authorization`.
- Validate comment anchoring (`line`/`side`) end-to-end against a real PR — this closes the
  riskiest loop in the MVP (MVP.md §7, with BL-010).
- Never auto-approve or auto-resolve (CLAUDE.md working agreements).
