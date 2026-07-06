# BL-028 — Cockpit TUI (`triage fleet|sessions|repo`)

- **Milestone:** CR3 (Control Room — cockpit surfaces)
- **Depends on:** BL-024 (health score), BL-025 (baseline source), BL-026 (CLI
  scaffolding); BL-027 for live session data
- **Constitution (Control Room):** Serves the first principle — this is the fleet made
  legible where the lead already lives, the terminal. Serves principle 5: every view is
  read-only; the only "actions" are printing URLs to act elsewhere.

## Summary

The CLI's second face: cockpit subcommands rendering the fleet in the terminal.
`triage fleet` — the repo × health grid; `triage sessions` — active/stale sessions
across the fleet; `triage repo <owner/repo>` — one repo's drill-down (score components,
provenance trend, CI health, recent sessions). The terminal sibling of the web cockpit,
reading the same `@triage/fleet` core.

## Scope

- Fleet registry config at `~/.config/triage/fleet.json`: repo list + token source
  (env var name — the token itself never lands in the config file). `triage init`
  scaffolds it.
- `triage fleet`: one row per repo — health score/grade (partial/unknown labelled per
  BL-024), provenance share, agent CI failure rate, active sessions (or `—` for
  baseline-tier repos). Sorted worst-first.
- `triage sessions`: active and stale sessions with repo, agent, age, and PR/branch;
  stale visually distinct.
- `triage repo`: the component breakdown behind the score, top failing checks, and the
  PRs awaiting human review (with URLs — the hand-off to Triage/GitHub).
- Rendering: plain ANSI tables + color, no interactive TUI framework; `--watch` for
  periodic re-render honoring the source's rate budget; `--json` on every view for
  scripting.
- Data-freshness line on every view ("as of 14:02, 38/40 repos fresh") — tiered truth
  applies to time, too.

## Out of scope (deferred)

- Interactive navigation (a full TUI à la k9s) — earn it after the static views prove
  the data model; notifications; any mutating command.

## Acceptance

- With a registry pointing at fixture sources, all three views render correct numbers,
  labels for partial/unknown, and stale-vs-active sessions.
- `--json` output is schema-stable (covered by a test) so scripts can depend on it.
- A repo erroring (bad token / rate limit) renders as that repo's error row; the rest
  of the fleet still displays.
- Runs headless in CI (no TTY assumptions when piped; color auto-disables).

## Technical notes

- Keep the shell thin (testing rules): formatting/roll-ups live in `@triage/fleet`
  (`format.ts` in the prototype is the precedent — promote, don't duplicate).
- `--watch` re-renders from cache between refresh ticks rather than re-fetching per
  frame.
