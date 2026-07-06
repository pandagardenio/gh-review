# BL-027 — Ledger fleet source + active sessions

- **Milestone:** CR2 (Control Room — data sources)
- **Depends on:** BL-021 (schema, FleetSource), BL-025 (baseline source to compose
  with); pairs with BL-026 (which writes what this reads)
- **Constitution (Control Room):** Serves principle 2 (the rich tier becomes readable,
  and its absence stays an honest *unknown*) and principle 4 (ledger branches are read
  client-side like everything else).

## Summary

The read side of the ledger convention: a source in `@triage/fleet` that fetches each
repo's `triage/ledger` branch, parses the JSONL into `SessionRecord`s and
`HookEventRecord`s, and derives **active sessions** — the "how many sessions are
running right now" number. Composes with BL-025 into the single tiered `FleetSource`
the surfaces consume.

## Scope

- Fetch ledger files via the contents/git-trees API for repos that have the branch;
  a missing branch marks the repo baseline-tier (`sessions: null`), not empty.
- Parse per the BL-021 schema: skip-and-count malformed lines (never fail the repo on
  one bad record), tolerate unknown fields.
- **Active-session derivation:** started, no `session-end`, and a heartbeat within the
  freshness window (default ~10 min, configurable). A session past the window without
  an end record renders **stale**, distinct from both active and ended — crashes
  happen, and "8 active" must not silently include ghosts.
- Compose baseline + ledger into one `TieredFleetSource`, per-repo tier flags exposed
  so surfaces can label partial data.
- Compatibility mapping: a dark-factory `factory/ledger` `RunRecord` maps onto
  `SessionRecord` (station → stage tag), so the existing prototype repo stays legible.

## Out of scope (deferred)

- Writing anything (BL-026); webhooks/streaming — v1 is refresh-on-demand;
  cross-repo session identity (a session that touches two repos is two sessions).

## Acceptance

- Fixture ledgers yield correct session lists; active/stale/ended classification is
  correct at the window boundary (test both sides of it).
- A malformed line is skipped, counted, and surfaced ("2 unparseable records"), and
  the rest of the repo's ledger still loads.
- A repo without the branch reports `sessions: null` and the composed source flags it
  baseline-tier.
- A factory-ledger fixture maps to sessions without loss of status/usage.

## Technical notes

- Ledger reads are cheap (one branch, few files) — reuse BL-025's conditional-request
  cache so fleet refreshes stay within the rate budget.
- The freshness window and BL-026's heartbeat throttle are coupled constants — document
  the relationship in the schema doc so they change together.
