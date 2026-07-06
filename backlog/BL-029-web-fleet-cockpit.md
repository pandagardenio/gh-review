# BL-029 — Web fleet cockpit (generalize `apps/web`)

- **Milestone:** CR3 (Control Room — cockpit surfaces)
- **Depends on:** BL-024 (health score), BL-025 (baseline source); BL-027 for sessions;
  supersedes the single-repo prototype wiring in `apps/web`
- **Constitution (Control Room):** Serves the first principle (the rich fleet view)
  and principle 4 (static SPA, user token, no backend). Serves principle 5 — the
  Review pane remains a hand-off into Triage/GitHub, never an in-place approval.

## Summary

Promote the `apps/web` control-room prototype from one dark-factory repo to the fleet:
a fleet overview page (repo × health grid, fleet-wide provenance and CI trends, active
sessions) that drills down into a per-repo view — where the prototype's existing
Observe / Configure / Review panes live on, now fed by the tiered `FleetSource`.

## Scope

- Migrate the prototype off its local `FactorySource` onto `@triage/fleet`'s
  `TieredFleetSource`; delete the duplicated model/roll-up code that BL-021–BL-024
  promoted into the package (the prototype's `ledger.ts` arithmetic moves, its tests
  move with it).
- **Fleet page** (new default route): health-sorted repo grid mirroring
  `triage fleet`'s columns, fleet-wide provenance share and agent CI failure trend,
  active-session count. Partial/unknown labelling per BL-024; per-repo error states
  per BL-025.
- **Repo page**: the existing three panes, plus the score-component breakdown and a
  sessions list (active/stale/recent).
- Fleet registry: repo list in `localStorage` with URL-param override (extending the
  prototype's `?repo=` convention); token via the existing `TokenStore` pattern.
- `FixtureFleetSource` remains the zero-config default, demo banner intact.
- CSP-safe DOM throughout (existing `@triage/ui` helpers + forbidden-pattern rules
  already enforce this).

## Out of scope (deferred)

- Embedding Triage's review flow in the web app (Review keeps deep-linking out);
  historical charting beyond the metric window; auth flows beyond a pasted token;
  extraction to its own repo (explicitly anticipated by the prototype README — do it
  when it graduates, not now).

## Acceptance

- Zero-config load renders the fleet page from fixtures; pointing the registry at real
  repos renders live baseline-tier data.
- A rich-tier fixture repo shows sessions and a full score; a baseline-only repo shows
  `—` sessions and a `partial` score — side by side, honestly labelled.
- Repo drill-down preserves the prototype's Observe/Configure/Review behaviour (its
  existing view tests keep passing after the source swap).
- No roll-up arithmetic remains under `apps/web/src` (entry shells stay thin) — grep
  guard or review checklist.

## Technical notes

- The dark-factory repo stays first-class via BL-027's compat mapping — the prototype's
  current single-repo experience must not regress into a special case that bit-rots.
- Keep bundle discipline: the SPA already builds statically with Vite; the fleet page
  adds no new runtime dependencies.
