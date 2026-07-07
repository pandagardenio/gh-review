# @triage/fleet

The **Control Room's** provider- and UI-agnostic core — the fleet analogue of
`@triage/engine`. Pure model, contracts, and (as the CR1 stream lands) metric roll-ups;
no DOM, no network, no app imports. The same code runs from the CLI cockpit (node) and
the web cockpit (browser).

Governed by [`../../CONTROL-ROOM-CONSTITUTION.md`](../../CONTROL-ROOM-CONSTITUTION.md).
Its hard line — *measure machines and harnesses, never people* — is enforced here by
construction: no exported type uses a person as an aggregation key. The only identity a
record carries is `agent` (the harness name, e.g. `claude-code`).

## What's here (BL-021)

- **Model** (`src/model/`): `FleetRepo` + `Tier`, the rich-tier `SessionRecord` /
  `HookEventRecord`, and the baseline-tier GitHub inputs (`CommitRecord`, `PullRecord`,
  `CheckRecord`).
- **`FleetSource`** (`src/source.ts`): the data boundary surfaces read. Baseline methods
  return arrays; rich-tier methods return `null` for an uninstrumented repo — `null`
  ("unknown") stays distinct from `[]` ("none").
- **Session-ledger schema** (`src/ledger/schema.ts` + [`docs/session-ledger.md`](./docs/session-ledger.md)):
  the versioned JSONL contract the emitter (BL-026) writes and the ledger source
  (BL-027) reads. `serializeLedgerLine` / `parseLedgerLine`, forward-compatible.
- **`FixtureFleetSource`** (`src/fixture-source.ts`): baked multi-repo data — two
  instrumented repos and one baseline-only — so surfaces build and test with zero config.

## What lands later

- Metric roll-ups: provenance (BL-022), CI health (BL-023), harness-health score
  (BL-024) — pure functions over the model above.
- Real sources: `GitHubFleetSource` (BL-025) and the composed ledger source (BL-027).

## Commands

```sh
pnpm --filter @triage/fleet build       # vite lib build + .d.ts emit
pnpm --filter @triage/fleet test        # vitest (node env)
pnpm --filter @triage/fleet typecheck   # tsc --noEmit
```

## Isolation

Same discipline as the engine, enforced two ways: the `fleet-isolation`
forbidden-pattern rule bans imports of `@triage/ui` or app code, and `tsconfig` omits
the DOM/`chrome` libs so a browser global fails to compile. Dependencies flow one way:
apps → fleet/ui → engine.
