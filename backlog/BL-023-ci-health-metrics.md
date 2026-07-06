# BL-023 — CI-health metrics for agent work

- **Milestone:** CR1 (Control Room — fleet core)
- **Depends on:** BL-021 (fleet model types), BL-022 (agent classification)
- **Constitution (Control Room):** Serves the first principle ("are agents failing CI
  frequently" is a core fleet-legibility question) and principle 5 (we *read* checks —
  never re-run, never gate).

## Summary

Pure roll-ups in `@triage/fleet` over check runs of agent-authored PRs: how often agent
work fails CI, how long it takes to go green, and how that compares to the repo's
human-authored baseline — per repo and fleet-wide, trending over a window.

## Scope

- `ciHealth(pulls, checks, classification, window)` producing, per repo and aggregate:
  - **failure rate** — share of agent PRs whose head ever had a failing required check;
  - **time-to-green** — p50/p95 from first push to first all-green check suite;
  - **red-to-green cycles** — how many failing→passing transitions a PR needed (the
    "agent kicked CI N times" signal);
  - the same numbers for the human-authored remainder, as an anonymous aggregate
    baseline (no names — it exists only so "agents fail 2× more than baseline" is
    sayable).
- Failure clustering by check name (reuse the shape of the prototype's
  `clusterFailures`), so "which check do agents trip over" is answerable.
- Trend buckets (day/week) like BL-022.

## Out of scope (deferred)

- Fetching checks (BL-025), log analysis of *why* a check failed, flaky-test detection.
- Anything that annotates or re-runs a check.

## Acceptance

- Fixture PRs with check histories produce correct failure rate, time-to-green
  percentiles, and cycle counts; a PR with no checks is excluded, not counted green.
- Repos with too few agent PRs in the window report `null` rates (tiered truth —
  no confident numbers from 2 data points), with the threshold explicit and tested.
- The human baseline is a single aggregate — the output type has no per-author field.

## Technical notes

- "Ever had a failing check" must be computed per head SHA, not per PR-latest — a PR
  that was red and force-pushed green still counts as a failure for the rate.
- Required-vs-optional checks differ per repo (branch protection); v1 counts all
  completed check runs and notes the simplification in the type's doc comment.
