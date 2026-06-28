# BL-002 — PR diff loader (`.diff` fast path + API fallback)

- **Milestone:** M1
- **Depends on:** BL-001
- **Constitution:** Serves principle 5 (robustness over cleverness; never silently
  mislead) and principle 1 (we cannot triage what we cannot load). Strains none.

## Summary

Load the changed files and per-file patches for a PR, provider-agnostically, without ever
scraping the virtualized diff DOM.

## Scope

- **Fast path:** fetch same-origin `/{owner}/{repo}/pull/{n}.diff` (no token).
- **Fallback:** on `.diff` failure, call REST `/repos/{owner}/{repo}/pulls/{n}/files`
  using a token obtained via the BL-001 token-storage interface.
- Parse both sources into a single normalized file model: `{ path, status, additions,
  deletions, patch, isBinary }` — the engine's diff model, consumed by everything
  downstream.
- Extract PR coordinates (`owner`, `repo`, `number`, `headSha`) from the page URL/context.

## Out of scope

- Rendering (BL-006), categorization (BL-003), token UI/entry (BL-013/BL-014).

## Acceptance

- On a public PR, the `.diff` path returns the full file list with patches and **no token
  required**.
- On a private PR (where `.diff` is CSP-blocked on its cross-origin 302 redirect and
  `fetch` throws "Failed to fetch"), the loader **falls back to the API** and succeeds with
  a token.
- A `.diff` failure is **never** reported as "PR too large" — the error surfaced
  distinguishes CSP-blocked redirect vs. genuine size/network vs. missing-token (MVP.md
  §6, Constitution §5 — the bug we already got bitten by).
- Files with no `patch` (binary/large) are represented with `isBinary`/patchless flag, not
  dropped.

## Technical notes

- `api.github.com` is in GitHub's `connect-src` and its CORS preflight allows
  `Authorization` from a `github.com` origin; the session cookie does **not** authenticate
  it — a token is required for the fallback (MVP.md §6).
- Never read the file list or content from the DOM; the Files-changed view is virtualized
  (MVP.md §6).
