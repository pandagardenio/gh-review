# SonarCloud setup (one project per package)

Triage runs **one independent SonarCloud project per workspace package** — separate
dashboard, quality gate, and PR check for `@triage/engine`, `@triage/ui`,
`@triage/extension`, and `@triage/web`. The CI matrix in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) drives this from a single source
of truth, [`.github/sonar-projects.json`](../.github/sonar-projects.json).

Until the `SONAR_ORGANIZATION` repo variable is set, the Sonar jobs are skipped and CI
stays green — so you can land this wiring before the SonarCloud side exists.

## One-time setup

### 1. Organization

1. Sign in to <https://sonarcloud.io> with GitHub and create (or pick) an **organization**
   bound to the `pandagardenio` GitHub org.
2. Note its **organization key** (e.g. `pandagardenio`).

### 2. Create one project per package

For each of the four packages, **Analyze new project → set up manually** (monorepo: four
projects from one repo). Give each a project key and put that exact key in
`.github/sonar-projects.json`. Suggested keys (already in the file — change them to match
what you create):

| Package | Path | Project key |
| --- | --- | --- |
| `@triage/engine` | `packages/engine` | `pandagardenio_gh-review--engine` |
| `@triage/ui` | `packages/ui` | `pandagardenio_gh-review--ui` |
| `@triage/extension` | `apps/extension` | `pandagardenio_gh-review--extension` |
| `@triage/web` | `apps/web` | `pandagardenio_gh-review--web` |

> SonarCloud project keys are globally unique and prefixed with the org. These four are
> already created. The JSON file is the source of truth the CI matrix and `/pr` read — keep
> it in sync with whatever exists in SonarCloud.

### 3. Turn off Automatic Analysis

For **each** project: **Administration → Analysis Method → turn OFF "Automatic Analysis"**.
CI-based analysis (our matrix) and Automatic Analysis are mutually exclusive; leaving it on
makes scans fail with "you are running CI analysis while Automatic Analysis is enabled".

### 4. Token + repo config

1. **Account → Security** (or **Organization → Administration → Security**) → generate a
   token.
2. In the GitHub repo: **Settings → Secrets and variables → Actions**:
   - **Secret** `SONAR_TOKEN` = the token.
   - **Variable** `SONAR_ORGANIZATION` = your organization key. (Setting this flips the CI
     Sonar jobs on.)

### 5. (Optional) Required checks

In the branch ruleset for `main`, require the **`CI Gate`** check — a single aggregate job
that passes only when `verify` succeeds and the Sonar jobs succeed or are legitimately
skipped. You don't mark the per-package `SonarCloud (@triage/…)` checks individually, so
adding a package (or a Sonar project) never means editing the ruleset. Because each scan
runs with `-Dsonar.qualitygate.wait=true`, a red quality gate fails its `sonar` matrix leg,
which fails the gate.

## How it works in CI

- `verify` runs lint + typecheck + test + build (always).
- `sonar-matrix` reads `.github/sonar-projects.json` and emits the matrix.
- `sonar` runs once per package: installs, runs that package's `test:coverage` (Vitest v8 →
  `coverage/lcov.info`), then `sonarqube-scan-action` with `projectBaseDir` set to the
  package and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.

Apps with no tests yet (`@triage/extension`, `@triage/web`) are analyzed without coverage
until they gain tests — the scan still runs.

### Coverage exclusions (thin entry shells)

The "Sonar way" gate fails new code with < 80% coverage. The per-target **entry shells**
(`apps/extension/src/content.ts`, `apps/web/src/main.ts`) are bootstrap glue that's
exercised through the packages they import (see `.claude/rules/testing.md`), so they're
excluded from the *coverage* requirement — but still analyzed for bugs/smells/security.

Each `.github/sonar-projects.json` entry carries an optional `coverageExclusions` (a
comma-separated, project-relative glob list) passed to `-Dsonar.coverage.exclusions`. Leave
it `""` for packages whose code should be fully covered (`engine`, `ui`). When an app grows
real, testable logic beyond its entry shell, write tests for it rather than widening the
exclusion.

## Adding a package later

Add an entry to `.github/sonar-projects.json`, create the matching SonarCloud project, and
ensure the package has a `test:coverage` script. The matrix picks it up automatically.

## In the review loop

`/pr` queries each package's quality gate via the SonarCloud API when a `SonarCloud` check
is red (or before declaring green). See `.claude/skills/pr/SKILL.md` §3a.
