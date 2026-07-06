# BL-025 — GitHub baseline fleet source

- **Milestone:** CR2 (Control Room — data sources)
- **Depends on:** BL-021 (FleetSource contract); feeds BL-022/023/024
- **Constitution (Control Room):** Serves principle 2 (this *is* the baseline tier —
  every repo legible with zero setup), principle 3 (GitHub as system of record,
  read-only), and principle 4 (runs client-side with the user's token; token storage
  reuses the engine's pluggable `TokenStore` contract).

## Summary

A `GitHubFleetSource` in `@triage/fleet` that reads the baseline tier for a list of
repos over the REST API: commits (with messages, for trailer classification), merged
PRs, review states, and check runs. Environment-agnostic (global `fetch`, no DOM), so
the same source powers the cockpit TUI (node) and the web app (browser).

## Scope

- Implements `FleetSource` for the baseline methods; rich-tier methods return `null`
  (that's BL-027's job).
- Input: a fleet registry — `{ repos: [owner/repo, ...] }` — plus a `TokenStore`.
- Windowed fetching: only the metrics window (e.g. 30 days) of commits/PRs/checks, not
  full history.
- **Rate-limit discipline** — the make-or-break for 40 repos:
  - conditional requests (ETag / `If-None-Match`) with a pluggable cache (localStorage
    in the browser, a file in the CLI);
  - a shared budget across repos with fair scheduling, and a visible "data as of /
    N repos refreshed" status instead of silent staleness (tiered truth);
  - back-off on `403`-with-`retry-after`, never a hot retry loop.
- Plain, non-misleading errors per repo (bad token vs no access vs rate-limited), so
  one broken repo never poisons the fleet view.

## Out of scope (deferred)

- The ledger/rich tier (BL-027); GraphQL batching (note as a later optimization if the
  REST budget proves too tight); org-wide repo discovery (v1 takes an explicit list).

## Acceptance

- Against a real repo (dogfood: this one), the source yields commits/PRs/checks that
  produce correct BL-022/BL-023 numbers for a hand-verified window.
- A second refresh with an unchanged repo consumes conditional requests (test via
  injected fetch: 304s served from cache).
- A rate-limited or unauthorized repo surfaces as that repo's explicit error state;
  the other repos still load.
- The same build runs under node and jsdom test envs (no DOM globals).

## Technical notes

- `fetch` is stubbed at the boundary in tests (per testing rules) — no live network in
  CI.
- Check runs come per head SHA (`/commits/{sha}/check-runs`); fetch only for PR head
  SHAs in the window to keep the request count linear in PRs, not commits.
