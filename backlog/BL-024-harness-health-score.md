# BL-024 — Harness-health score

- **Milestone:** CR1 (Control Room — fleet core)
- **Depends on:** BL-021 (session/hook types), BL-022, BL-023 (component metrics)
- **Constitution (Control Room):** Serves the first principle — this is the single
  per-repo answer to "is this project's harness working". **Strains principle 2
  (tiered truth)** by design, since a composite invites hiding missing inputs;
  justification: the score is explicitly *partial-aware* — every rendering carries
  which components were absent, and a score is never computed from fewer than the
  documented minimum. A silently degraded score would be the exact failure mode
  Triage principle 5 exists to prevent.

## Summary

A composite, per-repo **harness health** signal in `@triage/fleet`, computed from four
components: agent CI failure rate (BL-023), session failure/escalation rate (rich
tier), hook-friction rate (hook blocks per session — rich tier), and review escalation
rate (share of agent PRs receiving `CHANGES_REQUESTED` — baseline tier). One number a
lead can rank 40 repos by, with the receipts attached.

## Scope

- `harnessHealth(components)` → `{ score: number | null, grade, components: [...] }`
  where each component reports its value, its weight, and `available: boolean`.
- Tier-awareness: baseline-only repos compute from the two baseline components and are
  marked `partial`; below the minimum (≥2 components), `score: null` — rendered as
  *unknown*, never 0 or an average of nothing.
- The weighting lives in one editable structure with documented defaults — product
  surface, like the categorization rules (MVP.md §3).
- Fleet ranking helper: order repos by score with `partial`/`unknown` grouped and
  labelled, never interleaved as if comparable.

## Out of scope (deferred)

- Alerting/thresholds ("page me when a repo goes red") — a later item once the score
  earns trust.
- Auto-diagnosis of *why* a harness is unhealthy; the score links to its components,
  the human investigates.
- Any human-performance component — permanently out, by constitution.

## Acceptance

- A fixture repo with all four components produces a full score; the same repo minus
  the rich tier produces a `partial` score from the remaining components with the
  missing ones listed; one component only produces `score: null`.
- Component weights are configurable and the default is covered by a test (so a weight
  change is a deliberate, visible diff).
- Ranking output separates full / partial / unknown repos (test asserts no unknown repo
  outranks a scored one).

## Technical notes

- Review escalation rate comes from PR review states in the baseline tier — no new
  data source needed.
- Hook-friction rate normalizes hook blocks by session count, not by time, so busy and
  quiet repos are comparable.
