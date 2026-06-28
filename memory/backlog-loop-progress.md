---
name: backlog-loop-progress
description: Status of the autonomous backlog loop — which BL items are merged vs pending
metadata:
  type: project
---

Running an autonomous `/loop` over the backlog (`backlog/BL-0*.md`): one PR per
item, automerge (`gh pr merge <n> --auto --squash`), start the next item when
the prior PR merges. Merges gate on CI + SonarCloud (see [[sonarcloud-quality-gate]]).

Delivery order followed: BL-002, BL-003 → BL-004 → BL-005 → BL-006 → BL-007 …
(dependency order from `backlog/README.md`).

**As of 2026-06-29:**
- BL-001 (scaffolding) — merged (pre-loop, PR #1).
- BL-002 (diff loader) — merged, PR #2.
- BL-003 (categorization engine) — merged, PR #4.
- BL-004 (dependency expansion) — PR #5, awaiting merge.
- BL-005 (triage panel — first UI item) onward — pending.
- Side chores (permission allowlist): PR #3 merged; PR #6 pending.

**How to apply:** on resume, `gh pr list --state open` and check the merge
state of the in-flight PR before starting the next item; sync `main` and cut a
fresh `<type>/<slug>` branch per item (never commit to main).
