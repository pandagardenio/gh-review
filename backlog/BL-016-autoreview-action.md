# BL-016 — Autoreview GitHub Action

- **Milestone:** Tooling (opt-in CI surface; independent of M1–M5)
- **Depends on:** BL-002 (diff/API file model), BL-003 (categorization engine)
- **Constitution:** Serves principle 1 (reduce human escalation — wave through the
  null case so attention concentrates where risk does). **Strains principle 4**
  ("the tool never approves") and the non-goal "not a CI gate" — allowed under the
  bounded, written carve-out in `CONSTITUTION.md` ("A note on the autoreview
  action") and `MVP.md` §9. Honours principle 3 (augment — speaks via GitHub's
  review primitives; "human required" is a neutral comment, never a block) and
  principle 5 (states its reasoning, idempotent, dismisses its own stale approval).

## Summary

A GitHub Action that triages a PR in CI and **auto-approves the null case** — a PR
whose changes touch nothing review-required — while deferring anything intent/risk-
bearing to a human. A **separate, opt-in surface, not the browser plugin**; the
plugin still never approves.

## Scope

- Reuse the §3 categorization to define "review-required" (dependencies, harness,
  CI, config, tests). `code`/`docs` are the low-risk null case.
- Pure decision in the engine (`packages/engine/src/autoreview/`):
  `evaluateAutoReview(categories, policy)` + `parseAutoReviewPolicy`.
- Configurable "no review-required files" policy: `auto` | `never` |
  `threshold(maxFiles)` — via `.github/triage-autoreview.json` or action inputs.
- Node entry shell (`apps/action`) doing GitHub I/O: list PR files, evaluate,
  submit an `APPROVE` or a neutral `COMMENT` review.
- Composite `action.yml` + `.github/workflows/autoreview.yml` wiring it on
  `pull_request` with `pull-requests: write`.

## Out of scope (deferred)

- Configurable *relevance* (which categories/paths count) — for now it is the
  engine's definition. Per-category thresholds, path globs, line-count budgets.
- Reusing the action from *external* repos (the composite assumes this workspace).
- Anything that judges code correctness — explicitly never in scope.

## Acceptance

- A code/docs-only PR is approved with a stated reason; a PR touching any
  review-required category gets a "human review required" comment, never an
  approval.
- `mode: never` never approves; `mode: threshold` approves the null case only
  within the file cap; a review-required file always wins over the threshold.
- Idempotent on re-runs (same head ⇒ no duplicate reviews); a prior auto-approval
  is dismissed once the PR gains review-required changes.

## Technical notes

- Forks get a read-only token — the workflow skips them rather than failing.
- `github-actions[bot]` approvals do **not** satisfy required-reviewers branch
  protection, and the bot cannot approve a PR it authored (falls back to a
  comment). Document for adopters.
- The action bundles the engine into a self-contained `dist/main.js` (Node 22,
  global `fetch`), mirroring how the extension bundles engine + ui.
