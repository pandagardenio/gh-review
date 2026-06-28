# BL-010 — Inline draft comments

- **Milestone:** M4
- **Depends on:** BL-006
- **Constitution:** Serves principle 3 (augment via GitHub's comment primitive) and
  principle 4 (the reviewer authors the comment; the tool never judges). Strains none.

## Summary

> *(core of the review loop)* — attach comments to specific lines in the rendered diff,
> held locally until submission (MVP.md §4.2 "Inline comments").

## Scope

- Attach a comment to a specific line within the rendered diff (BL-006).
- Comment is anchored to `path` + `line` + `side` (**LEFT** / **RIGHT**).
- Comments are held in the local draft (BL-011) until the review is submitted (BL-012).
- Add / edit / remove a comment before submission.
- **Single-line comments only** in MVP (MVP.md §2).

## Out of scope

- Multi-line / suggested-change comments (deferred, MVP.md §2).
- Submission to GitHub (BL-012); persistence wiring (BL-011).

## Acceptance (MVP.md §4.2)

- A comment can be added, edited, and removed before submission.
- It is correctly anchored to `path` + line + side (LEFT/RIGHT).

## Technical notes

- **Highest-risk integration in the MVP** (MVP.md §7): confirm anchoring behavior for
  comments on **context lines** and on the **LEFT side of large hunks** against a real PR
  early. The `line`/`side` shape here must match exactly what BL-012 POSTs to the Reviews
  API; validate end-to-end as soon as both exist.
