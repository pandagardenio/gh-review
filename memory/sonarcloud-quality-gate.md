---
name: sonarcloud-quality-gate
description: CI gates each package on a SonarCloud quality gate; bare Array.sort fails it
metadata:
  type: project
---

Each package has its own SonarCloud quality gate that runs in CI and **blocks
merge** (the "CI Gate" check aggregates them). On **new code** it requires:
reliability rating A (`new_reliability_rating ≤ 1`), security A, maintainability
A, coverage ≥ 80%, duplicated lines < 3%, security hotspots 100% reviewed.

**Gotcha that bit BL-004 (PR #5):** `Array.prototype.sort()` with no comparator
is a CRITICAL reliability bug to Sonar (sorts by UTF-16 code units). Always pass
one — for strings, `.sort((a, b) => a.localeCompare(b))`.

**How to apply:** write engine/UI code to A-rating on the first pass (no bare
sorts, handle nullables, no obvious bugs) so the gate passes without a fix
round-trip. To diagnose a failure: `curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=pandagardenio_gh-review--<pkg>&pullRequest=<n>"`
for the failing condition, then `.../api/issues/search?componentKeys=...&pullRequest=<n>&types=BUG&resolved=false`
for the specific issue. Related: [[backlog-loop-progress]].
