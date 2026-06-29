# @triage/action — autoreview (BL-016)

A GitHub Action that triages a pull request and **auto-approves the null case** —
a PR whose changes touch nothing review-required — while routing anything that
carries intent or risk to a human.

> **Constitution note.** The browser plugin never approves (principle 4). This
> Action is a **separate, opt-in CI surface** that deliberately does, for the
> narrow null case only. The written carve-out lives in
> [`CONSTITUTION.md`](../../CONSTITUTION.md) and [`MVP.md` §9](../../MVP.md).

## What counts as "review-required"

The same categorization the plugin uses (`@triage/engine`). Per Constitution
principle 1, the intent/risk-bearing categories are **dependencies, harness, CI,
config, tests**. `code` and `docs` are low-risk leaf categories. So:

- A PR touching **only** `code` / `docs` → eligible for auto-approval.
- A PR touching **any** dependency / harness / CI / config / test file → a human
  is required; the bot posts a neutral comment and never approves.

This relevance definition will become configurable; for now it is the engine's.

## Policy — the "no review-required files" behaviour

Configurable via `.github/triage-autoreview.json` or action inputs (inputs win):

| mode        | behaviour                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| `auto`      | Approve whenever nothing review-required changed. *(default)*             |
| `never`     | Never auto-approve; always defer to a human.                             |
| `threshold` | Approve the null case only when total changed files ≤ `maxFiles`.        |

```jsonc
// .github/triage-autoreview.json
{ "mode": "threshold", "maxFiles": 10 }
```

```yaml
# or inline in the workflow
- uses: ./apps/action
  with:
    mode: threshold
    max-files: '10'
```

## Wiring

[`.github/workflows/autoreview.yml`](../../.github/workflows/autoreview.yml) runs
it on `pull_request` with `pull-requests: write`. It checks out and calls the
local composite action, which installs, builds `@triage/engine` + `@triage/action`,
and runs `dist/main.js`.

## Behaviour & limits

- **Idempotent.** Re-running on the same head SHA does not duplicate reviews.
- **No stale approval.** If an approved PR later gains review-required changes,
  the bot dismisses its own prior approval before deferring to a human
  (principle 5 — never silently mislead).
- **Never blocks.** "Human review required" is a neutral `COMMENT` review, not a
  change request. The *absence* of an approval is what requires the human —
  enforce it with branch protection ("require approving review").
- **Forks** get a read-only token, so the workflow skips fork PRs.
- **Bot approvals** by `github-actions[bot]` do **not** satisfy GitHub's
  required-reviewers branch protection, and the bot cannot approve a PR it
  authored (it falls back to a comment). Document this for your team.

## Layout

| File             | Responsibility                                  |
| ---------------- | ----------------------------------------------- |
| `src/main.ts`    | Entry: wire context → engine → GitHub.          |
| `src/context.ts` | Read PR/repo/token from env + event payload.    |
| `src/config.ts`  | Resolve the policy from config file / inputs.   |
| `src/github.ts`  | REST client: list files, submit/dismiss review. |
| `src/summary.ts` | Build the Markdown review body.                  |

The decision itself (`evaluateAutoReview`, `parseAutoReviewPolicy`) is pure
engine logic in `packages/engine/src/autoreview/`.
