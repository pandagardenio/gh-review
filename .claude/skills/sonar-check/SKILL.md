---
name: sonar-check
description: >
  Diagnose and fix a failing SonarCloud quality gate on a PR in this repo. Use when the
  "CI Gate" or a "SonarCloud (@triage/<pkg>)" check fails, or before pushing to avoid a
  gate failure. Names the failing condition (coverage / reliability / etc.), maps it to a
  known cause, and gives the fix. Read-only diagnosis via the SonarCloud API.
allowed-tools: Read, Bash
---

# Sonar check

Each package is a separate SonarCloud project; CI runs a per-package quality gate and the
aggregate **CI Gate** check fails if any gate fails. Merges are blocked until it passes.

Project keys: `pandagardenio_gh-review--engine`, `pandagardenio_gh-review--ui`,
`pandagardenio_gh-review--extension`, `pandagardenio_gh-review--web`.

## 1. Find the failing condition

For the PR number `<n>` and package `<pkg>` (engine/ui/…):

```bash
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=pandagardenio_gh-review--<pkg>&pullRequest=<n>" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([{'m':c['metricKey'],'v':c.get('actualValue'),'thr':c.get('errorThreshold')} for c in d['projectStatus']['conditions'] if c['status']!='OK'])"
```

The gate is on **new code**: reliability/security/maintainability rating A
(`≤ 1`), `new_coverage ≥ 80`, `new_duplicated_lines_density < 3`, hotspots reviewed 100%.

## 2. Map condition → cause → fix

| Failing metric | Cause | Fix |
|---|---|---|
| `new_reliability_rating` (=4/E) | A reliability **bug** in new code. Most common here: `Array.sort()` with no comparator. | Query the bug (below); for sort, pass `(a,b) => a.localeCompare(b)`. |
| `new_coverage` = 0% with `new_lines_to_cover` = 1 | The **one** partially/uncovered new line — often a barrel `index.ts` re-export or a multi-branch one-liner (`sort` comparator). | Cover it: a barrel-import test (`import * as api from './index.js'`) executes every export line; or a test exercising every branch of the line. |
| `new_coverage` < 80 (general) | New logic under-tested. | Add unit tests for the new branches. |
| "Failed to resolve entry for package `@triage/…`" (job error, not a gate metric) | The per-package coverage job runs `pnpm --filter <pkg> run test:coverage` outside turbo, so workspace-dep `dist/` is absent. | Alias the dep to source in the package's vitest config: `test.alias: { '@triage/engine': resolve(__dirname, '../engine/src/index.ts') }`. |

Bug details when reliability fails:

```bash
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=pandagardenio_gh-review--<pkg>&pullRequest=<n>&types=BUG&resolved=false" \
  | python3 -c "import sys,json;[print(i['severity'],i['component'].split(':')[-1],'L'+str(i.get('line','?')),'-',i['message']) for i in json.load(sys.stdin).get('issues',[])]"
```

Coverage breakdown when `new_coverage` fails:

```bash
curl -s "https://sonarcloud.io/api/measures/component?component=pandagardenio_gh-review--<pkg>&pullRequest=<n>&metricKeys=new_lines,new_lines_to_cover,new_uncovered_lines,new_coverage" \
  | python3 -c "import sys,json;print({m['metric']:m['periods'][0]['value'] for m in json.load(sys.stdin)['component']['measures']})"
```

## 3. Reproduce coverage locally

```bash
pnpm --filter @triage/<pkg> run test:coverage   # prints the per-file % + uncovered line #s
```

## Prevention

- No bare `Array.sort()` — always pass a comparator (`localeCompare` for strings).
- Keep a barrel-import test (`src/index.test.ts`) in each package so a new export is never
  the lone uncovered new line.
- New workspace-dep imports in a package's tests need the vitest source alias.
