# BL-021 — Fleet core package (`@triage/fleet`) + session-ledger schema

- **Milestone:** CR1 (Control Room — fleet core)
- **Depends on:** BL-001 (monorepo scaffolding)
- **Constitution (Control Room):** Serves principle 2 (tiered truth — the types make
  the baseline/rich tiers explicit) and principle 4 (local-first — pure logic that runs
  in browser and node alike). Serves principle 1 by construction: no type in the model
  carries a human identity as an aggregation key.

## Summary

The Control Room's pure core: a new `packages/fleet` (`@triage/fleet`) holding the
fleet data model, the `FleetSource` boundary, and the **session-ledger schema** that
the emitter CLI writes and the sources read. Generalizes the `apps/web` prototype's
single-repo `FactorySource` to many repos, and its factory `RunRecord` to a
harness-agnostic `SessionRecord`.

## Scope

- Package scaffolding mirroring the engine: node-env Vitest, `.d.ts` emit, no DOM libs
  in `tsconfig`, and a new `fleet-isolation` forbidden-pattern rule (no imports of
  `@triage/ui` or app code; dependencies flow apps → fleet/ui → engine).
- Fleet model types: `FleetRepo` (repo + which tiers it has), `SessionRecord`
  (id, repo, agent identity, started/ended, status `running|success|failure|escalated`,
  usage, branch, PR), `HookEventRecord` (session, hook, rule id, outcome),
  `CommitRecord` / `PullRecord` / `CheckRecord` (the baseline-tier inputs).
- `FleetSource` interface: async reads for repos, sessions, commits, PRs, checks —
  every method tier-aware (a repo without the rich tier returns `null`, not `[]`,
  so "unknown" stays distinguishable from "none").
- The **session-ledger schema doc** (`packages/fleet/docs/session-ledger.md`):
  append-only JSONL records on a `triage/ledger` branch — the contract BL-026 writes
  and BL-027 reads. Versioned from day one.
- A `FixtureFleetSource` with baked multi-repo sample data, so surfaces build and test
  against it headlessly.

## Out of scope (deferred)

- Any metric arithmetic (BL-022/023/024) and any real I/O (BL-025/026/027).
- Migrating `apps/web`'s existing `FactorySource` onto this model (BL-029).

## Acceptance

- `pnpm --filter @triage/fleet build|test|typecheck` pass; the package emits types.
- The `fleet-isolation` rule blocks a UI/app import at Edit/Write time.
- `SessionRecord`/`HookEventRecord` round-trip through the documented JSONL schema
  (parse + serialize covered by tests, including unknown-field tolerance for forward
  compatibility).
- No exported type uses a person as an aggregation key (agent identity is the harness/
  agent name, e.g. `claude-code`, never an email or login of a human).

## Technical notes

- Mirror the engine's isolation enforcement: forbidden-pattern rule for imports plus a
  `tsconfig` without DOM/`chrome` libs so browser globals fail to compile.
- The dark-factory `factory/ledger` `RunRecord` maps onto `SessionRecord` (station →
  a `stage` tag); keep the mapping in mind but implement it in BL-027, not here.
