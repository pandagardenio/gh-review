# Backlog

Independent, PR-sized work items derived from [`../MVP.md`](../MVP.md). Each item is
scoped to be landable on its own (per the "small PRs scoped by category" agreement in
[`../CLAUDE.md`](../CLAUDE.md)) and is justified against
[`../CONSTITUTION.md`](../CONSTITUTION.md).

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

## Suggested delivery order

1. **M1 foundation:** BL-001 → BL-002, BL-003 (parallel) → BL-004, BL-005.
2. **M2 core:** BL-006 → BL-007.
3. **M3 tests:** BL-008 → BL-009.
4. **M4 review loop:** BL-010 → BL-011 → BL-012.
5. **M5 delivery:** BL-013 (any time after BL-001); BL-014 → BL-015.

The riskiest integration (comment anchoring, MVP.md §7) lives in BL-010/BL-012 — validate
it against a real PR as early as BL-006 lands, not at the end.
