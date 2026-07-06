# Backlog

Independent, PR-sized work items. BL-001–BL-020 derive from [`../MVP.md`](../MVP.md)
and are justified against [`../CONSTITUTION.md`](../CONSTITUTION.md); BL-021+ are the
**Control Room** stream (milestones CR1–CR3), justified against
[`../CONTROL-ROOM-CONSTITUTION.md`](../CONTROL-ROOM-CONSTITUTION.md). Each item is
scoped to be landable on its own (per the "small PRs scoped by category" agreement in
[`../CLAUDE.md`](../CLAUDE.md)).

## How to read an item

Every item file carries:

- **Milestone** — the MVP.md §8 milestone it belongs to.
- **Constitution** — the principle it serves; any principle it strains (principles 2 and
  4 require explicit written justification).
- **Scope / Out of scope** — the contract boundary.
- **Acceptance** — lifted from MVP.md; this *is* the definition of done.
- **Depends on** — hard prerequisites only. Everything else is parallelizable.

## Index

| ID | Title | Milestone | Depends on |
|----|-------|-----------|------------|
| [BL-001](./BL-001-scaffolding-and-build.md) | Project scaffolding & build split | M1 | — |
| [BL-002](./BL-002-pr-diff-loader.md) | PR diff loader (`.diff` + API fallback) | M1 | BL-001 |
| [BL-003](./BL-003-categorization-engine.md) | File categorization engine | M1 | BL-001 |
| [BL-004](./BL-004-dependency-expansion.md) | `package.json` dependency expansion | M1 | BL-002, BL-003 |
| [BL-005](./BL-005-triage-panel.md) | Triage panel (categorized navigator) | M1 | BL-003 |
| [BL-006](./BL-006-diff-renderer.md) | Unified diff renderer | M2 | BL-002 |
| [BL-007](./BL-007-sectioned-review-flow.md) | Sectioned review flow + viewed state | M2 | BL-005, BL-006 |
| [BL-008](./BL-008-test-case-parsing.md) | Test-case parsing (added/deleted/changed) | M3 | BL-006 |
| [BL-009](./BL-009-implementation-focus.md) | Implementation focus (jump to file under test) | M3 | BL-008 |
| [BL-010](./BL-010-inline-comments.md) | Inline draft comments | M4 | BL-006 |
| [BL-011](./BL-011-draft-persistence.md) | Draft persistence & recovery | M4 | BL-007, BL-010 |
| [BL-012](./BL-012-review-materialization.md) | Review materialization (submit to GitHub) | M4 | BL-010, BL-011 |
| [BL-013](./BL-013-bookmarklet-packaging.md) | Bookmarklet packaging (self-contained) | M5 | BL-001 |
| [BL-014](./BL-014-chrome-extension.md) | Chrome MV3 extension | M5 | BL-001 |
| [BL-015](./BL-015-cdn-manifest-channel.md) | CDN + manifest update channel (extension) | M5 | BL-001, BL-014 |
| [BL-016](./BL-016-autoreview-action.md) | Autoreview GitHub Action (opt-in CI surface) | Tooling | BL-002, BL-003 |
| [BL-017](./BL-017-release-workflow.md) | Release workflow (tag → build → GitHub Release) | Tooling | BL-013, BL-014, BL-015 |
| [BL-018](./BL-018-bookmarklet-pages-deploy.md) | Bookmarklet install page auto-deploy (Pages) | Tooling | BL-013, BL-017 |
| [BL-019](./BL-019-webstore-publish.md) | Chrome Web Store auto-publish | Tooling | BL-014, BL-017 |
| [BL-020](./BL-020-channel-publish.md) | Update channel auto-publish (static host) | Tooling | BL-015, BL-017 |
| [BL-021](./BL-021-fleet-core-package.md) | Fleet core package (`@triage/fleet`) + session-ledger schema | CR1 | BL-001 |
| [BL-022](./BL-022-provenance-metrics.md) | Provenance metrics (agent vs manual share) | CR1 | BL-021 |
| [BL-023](./BL-023-ci-health-metrics.md) | CI-health metrics for agent work | CR1 | BL-021, BL-022 |
| [BL-024](./BL-024-harness-health-score.md) | Harness-health score | CR1 | BL-022, BL-023 |
| [BL-025](./BL-025-github-baseline-source.md) | GitHub baseline fleet source | CR2 | BL-021 |
| [BL-026](./BL-026-cli-ledger-emitter.md) | CLI scaffolding + ledger emitter | CR2 | BL-021 |
| [BL-027](./BL-027-ledger-fleet-source.md) | Ledger fleet source + active sessions | CR2 | BL-021, BL-025 |
| [BL-028](./BL-028-cockpit-tui.md) | Cockpit TUI (`triage fleet\|sessions\|repo`) | CR3 | BL-024, BL-025, BL-026 |
| [BL-029](./BL-029-web-fleet-cockpit.md) | Web fleet cockpit (generalize `apps/web`) | CR3 | BL-024, BL-025 |
| [BL-030](./BL-030-release-please-semver.md) | Automated semver releases (Release Please) | Tooling | BL-017 |
| [BL-031](./BL-031-per-component-releases.md) | Per-component release trains (independent tags) | Tooling | BL-030 |

## Suggested delivery order

1. **M1 foundation:** BL-001 → BL-002, BL-003 (parallel) → BL-004, BL-005.
2. **M2 core:** BL-006 → BL-007.
3. **M3 tests:** BL-008 → BL-009.
4. **M4 review loop:** BL-010 → BL-011 → BL-012.
5. **M5 delivery:** BL-013 (any time after BL-001); BL-014 → BL-015.
6. **Release automation:** BL-017 first (the tag-triggered trigger surface), then
   BL-018, BL-019, BL-020 in parallel — each release deploys every surface with no
   manual steps. BL-020 can be deferred until the channel has a consumer.
7. **Versioning:** BL-030 (semver computed from conventional commits; releasing = one
   click on the rolling release PR) → BL-031 (independent tag families per app:
   `extension-v*`, `bookmarklet-v*`, `action-v*`).

The riskiest integration (comment anchoring, MVP.md §7) lives in BL-010/BL-012 — validate
it against a real PR as early as BL-006 lands, not at the end.

### Control Room (CR1–CR3)

1. **CR1 core:** BL-021 → BL-022 → BL-023 → BL-024 (pure `@triage/fleet` logic; each
   lands with fixtures only).
2. **CR2 sources:** BL-025 and BL-026 in parallel after BL-021 → BL-027 composes them.
3. **CR3 cockpits:** BL-028 and BL-029 in parallel; both are thin shells over the same
   core, so neither blocks the other.

The riskiest assumptions here are BL-025's **rate-limit budget at ~40 repos** (validate
against a real fleet-sized repo list as soon as BL-025 works, before building surfaces
on it) and BL-026's **ledger writes never disturbing a live session's working tree**
(validate in a scratch repo with a real Claude Code session early in BL-026). Surfaces
can start on `FixtureFleetSource` before either source lands.
