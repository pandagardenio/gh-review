# BL-022 — Provenance metrics: agent vs manual code share

- **Milestone:** CR1 (Control Room — fleet core)
- **Depends on:** BL-021 (fleet model types)
- **Constitution (Control Room):** Serves the first principle (fleet legibility — "how
  much of our code is agent-authored" is the headline number). **Touches principle 1**:
  classification reads commit trailers and authors, so the implementation must reduce
  them to an *agent identity or "human"* and discard the person — no per-person output
  ever leaves the classifier.

## Summary

Pure functions in `@triage/fleet` that classify commits and PRs as agent- or
human-authored, and roll the classification up into the provenance share — % of merged
PRs and % of merged lines that are agent-authored — per repo and fleet-wide, over a
time window.

## Scope

- `AgentIdentityConfig`: the signals that mark agent work, with sensible defaults —
  `Co-Authored-By` trailers (Claude, Copilot, …), branch prefixes (`claude/`, `codex/`),
  bot author logins (`*[bot]`). One editable structure, treated as product surface
  (like the categorization rules in MVP.md §3).
- `classifyCommit(commit, config)` → `{ provenance: 'agent' | 'human', agent: string | null }`.
  A human co-authoring an agent commit classifies as agent (the agent wrote it; the
  human steered) — document this choice.
- Roll-ups: `provenanceShare(commits | pulls, window)` → merged-PR share and
  merged-line share, per repo and aggregated, with the window (e.g. 7/30 days) as a
  parameter, not a constant.
- Trend support: shares computed per bucket (day/week) so surfaces can draw a series.

## Out of scope (deferred)

- Fetching commits/PRs from anywhere (BL-025 supplies them).
- Line-level attribution inside a mixed commit (a commit is atomic: all agent or all
  human).
- Any per-developer breakdown — permanently out, by constitution.

## Acceptance

- Fixture commits covering trailer, branch-prefix, bot-login, and plain-human cases
  classify correctly; an ambiguous commit (no signal) classifies `human`.
- Shares are correct for a fixture window and stable under empty input (no NaN — an
  empty window reports `null`, per "tiered truth").
- The classifier's output contains no human login/email fields (test asserts the type
  and the values).

## Technical notes

- Trailers arrive in the commit message body via the REST commits API — parse the
  `Co-Authored-By:` lines, case-insensitively, rather than relying on GitHub's parsed
  fields.
- Merged-line share uses per-commit `additions + deletions` from the baseline tier;
  when stats are absent (large-repo API omissions), that commit counts toward PR share
  but is excluded — not zeroed — from line share.
