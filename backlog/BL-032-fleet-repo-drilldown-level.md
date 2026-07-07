# BL-032 — Fleet-native repo drill-down (the missing middle level)

- **Milestone:** CR3 (Control Room — cockpit surfaces)
- **Depends on:** BL-028 (`buildRepoView` view-model, already built), BL-029 (web fleet
  page + factory drill-down)
- **Constitution (Control Room):** Serves principle 1 (the fleet made legible at every
  zoom) and principle 2 (tiered truth — the factory level appears only for repos that
  actually run the factory harness, never fabricated for a baseline repo). Serves
  principle 5 — every level stays read-only; the deepest level's Review pane is still a
  hand-off out to Triage/GitHub.

## Summary

BL-029 wired the web cockpit as two levels — **fleet grid → factory cockpit** — jumping
straight from the repo grid into the dark-factory Observe/Configure/Review panes and
skipping the level in between. Insert that missing middle: a **fleet-native repo view**
(the same `buildRepoView` the CLI's `triage repo` already renders), so the drill-down is
three levels of increasing resolution:

```
Fleet grid        (all repos,      FleetSource)
  └─ Repo view    (any repo,       FleetSource · buildRepoView)   ← this item
       └─ Factory (factory repos,  FactorySource · stations/policy)
```

The fleet answers *"how healthy is this repo?"* for every repo; the factory answers
*"what's happening inside the pipeline?"* only for a factory-instrumented repo. They are
not competing models — they are two zoom levels, and the factory is simply the deepest
one, available only where the harness is installed.

## Motivation (the bug BL-029 left)

Because `?repo=owner/repo` routes directly to the factory cockpit, drilling into a
**baseline-tier** repo is lossy today:

- In the demo, every repo drills into the *same* fixture factory data regardless of which
  row was clicked.
- Live, a repo with no `.factory/ledger` branch renders the error state ("Could not
  read …") instead of the health/CI/session data we *do* have for it.

The fleet-native repo view is the honest destination for those repos, and it makes the
factory an explicitly *optional deeper* level rather than the only drill target.

## Scope

- **Repo view** (new middle route, e.g. `?repo=owner/repo` default): render
  `buildRepoView(source, repo, window, now)` from `@triage/fleet` — the health-component
  breakdown behind the score, agent CI failure rate + top failing checks, the
  provenance trend, active/stale/recent sessions, and the PRs awaiting review (URLs out).
  CSP-safe DOM, zero arithmetic in the shell (mirrors the fleet page).
- **Factory as a conditional deeper level:** from the repo view, offer a "Factory"
  affordance (tab or link, e.g. `?repo=…&view=factory`) that opens the existing
  Observe/Configure/Review cockpit — shown **only** when the repo is factory-instrumented
  (a readable `.factory/ledger` / rich tier). A baseline repo shows no factory affordance;
  it never dead-ends in an empty factory cockpit.
- **Routing:** fleet grid → repo view → factory. Preserve deep-linking: `?repo=` lands on
  the repo view; `&view=factory` on the factory cockpit. Keep the fixtures path
  zero-config.
- Reuse the CLI/web shared view-model (`buildRepoView`) so the terminal `triage repo` and
  the web repo view can never drift — same discipline BL-028/BL-029 established.

## Out of scope (deferred)

- Detecting factory-instrumentation beyond "the rich tier / ledger branch is readable"
  (a dedicated capability probe can come later).
- Any new roll-up: `buildRepoView` already exists; this item is wiring + a conditional
  affordance, not new arithmetic.

## Acceptance

- Clicking a **rich-tier** repo opens the fleet-native repo view (score components, CI,
  sessions, provenance, review PRs), with a working "Factory" link into the existing
  cockpit.
- Clicking a **baseline-tier** repo opens the same repo view with `—`/`partial` where
  data is absent, and **no** factory affordance — it never renders an empty or
  wrong-repo factory cockpit.
- The existing factory Observe/Configure/Review tests keep passing (the cockpit is
  reached one level deeper, unchanged).
- `?repo=…` and `?repo=…&view=factory` deep-link to the right levels; zero-config still
  renders the fleet page from fixtures.

## Technical notes

- `buildRepoView` is already exported from `@triage/fleet` (BL-028) and covered by tests;
  this is a web-shell wiring item, so keep entry-shell thinness — no roll-up under
  `apps/web/src`.
- The factory-instrumentation check should lean on the tiered source's existing
  rich/baseline signal rather than a new network probe where possible.
