---
name: pr
description: >
  Create or update a pull request for the current branch using gh CLI, watch CI
  until all checks pass and no merge conflicts exist, then run a self-review phase
  (post inline comments, fix them, repush, resolve threads). Never creates duplicates
  — if a PR already exists, updates its title and body.
allowed-tools: Read, Bash
---

# Pull Request

Full rules: [../../rules/git.md](../../rules/git.md).

## Context (pre-injected)

- Emoji: !`grep -i emoji CLAUDE.local.md 2>/dev/null || echo "(missing)"`
- Current branch: !`git branch --show-current`
- Base branch: !`git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null | sed 's|origin/||' || echo main`
- Existing PR: !`gh pr view --json number,title,url,state 2>/dev/null || echo none`
- Commits ahead: !`git log origin/main..HEAD --oneline 2>/dev/null`
- Changed files: !`git diff origin/main...HEAD --name-only 2>/dev/null`

## Flow

### 1. Validate

- Never on `main`/`master`. Stop if so.
- Read emoji from `CLAUDE.local.md`; ask the user if absent, then create the file.
- Identify the backlog item the branch addresses (from the branch name or the user) so it can be linked.

### 2. Create or update

**No existing PR → create:**

```bash
gh pr create \
  --title "<type>: <emoji> <short description>" \
  --base <base-branch> \
  --body "$(cat <<'EOF'
## 💡 Summary
* <what this PR does and why — link the backlog item, e.g. BL-00X>

## 📝 Notes
* <constitution principle served / strained; principles 2 and 4 need explicit justification>

## 🧪 How to test
* <concrete step 1>
* <concrete step 2>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Base branch: the PR's upstream if set, otherwise `main`.

**Existing PR → update:**

```bash
gh pr edit <number> --title "..." --body "..."
```

Preserve any human-authored content in the existing body that remains valid.

### 3. Watch until green

```bash
gh pr checks <number> --watch
gh pr view <number> --json mergeable,mergeStateStatus
```

Loop:
- Poll until all CI checks pass and `mergeable` is not `CONFLICTING`.
- **CI failure** — `gh run view <run-id> --log-failed`, diagnose, fix, commit, push, resume watching.
- **SonarCloud quality-gate failure** — one Sonar project per package (keys in `.github/sonar-projects.json`). A failing `SonarCloud` check reports only pass/fail in `gh pr checks`; pull the specific violations from the API and treat them as CI failures. See **3a**.
- **Merge conflict** — rebase on base branch, resolve directly (see [../../rules/git.md](../../rules/git.md) merge-conflict protocol), push, resume watching.
- Stop only when all green AND no conflicts.

Report when CI is green: `"PR #N — all checks passed, no conflicts."` Then continue to the review phase.

### 3a. SonarCloud quality gate (per package)

Each workspace package is its own SonarCloud project — `.github/sonar-projects.json` maps
`name → path → projectKey`, and the CI matrix scans each independently with
`-Dsonar.qualitygate.wait=true`, so a red gate shows up as that package's `SonarCloud`
check. When one is red — or before declaring the PR green — query the gate directly to see
*which* conditions failed and *which* issues caused them.

Auth: prefer the **sonar MCP** if connected; otherwise fall back to `SONAR_TOKEN`
(`echo "$SONAR_TOKEN"` to confirm). If neither is available, say so and skip this sub-step
rather than blocking — `gh pr checks` still gates on the check itself. The organization key
is the repo variable `SONAR_ORGANIZATION`.

```bash
# For the failing package's projectKey (from .github/sonar-projects.json):
KEY=triage-engine   # e.g.

# Quality-gate conditions for this PR (status ERROR ⇒ gate failed)
curl -s -u "$SONAR_TOKEN:" \
  "https://sonarcloud.io/api/qualitygates/project_status?projectKey=$KEY&pullRequest=<number>" \
  | python3 -m json.tool

# The specific open issues introduced on this PR (the new_violations the gate counts)
curl -s -u "$SONAR_TOKEN:" \
  "https://sonarcloud.io/api/issues/search?componentKeys=$KEY&pullRequest=<number>&resolved=false&ps=100" \
  | python3 -c 'import json,sys
d=json.load(sys.stdin); print("total:",d["total"])
for i in d["issues"]:
    print("-",i["rule"],i.get("severity"),"|",i["component"].split(":")[-1],"line",i.get("line"),"|",i["message"])'
```

Treat each reported issue as an actionable CI failure: fix it in the working tree, commit
(`fix: <emoji> <summary> (SonarCloud <rule>)`), push, resume the watch loop. Don't game the
gate by marking issues won't-fix in SonarCloud — fix the code unless the user decides otherwise.

### 4. Review phase

Once CI is green, self-review the open PR before handing it to a human. Full protocol: [../../rules/git.md](../../rules/git.md) (PR review phase).

1. **Review** — run `/code-review --comment` against the PR. It posts each finding as an inline review comment, opening a resolvable thread per finding.
2. **Triage + fix** — read every comment; address each actionable one in the working tree. Group related fixes into a focused commit (`fix: <emoji> address PR review — <summary>`).
3. **Repush** — push the fixes; CI re-runs. Fold back into the watch loop (step 3) until green.
4. **Resolve** — reply to each addressed thread (point at the fix) and resolve it via GraphQL (`resolveReviewThread`); for comments you won't action, reply with the reason. Never resolve silently.
5. **Repeat** until no unresolved actionable comments remain and CI is green.

Report final status: `"PR #N — reviewed, M comments addressed, all resolved, CI green."`

## Rules

- Never create a PR from `main`/`master`.
- Never create duplicates — check existing-PR context first.
- Always use `gh` CLI, never GitHub web.
- Link the backlog item the PR closes.
- Keep PRs small and scoped by category (dogfood the thesis).
- Don't stop at CI-green — the PR isn't done until the review phase has run and every actionable comment is fixed-and-resolved (or has a recorded reason).
- Resolve review threads via GraphQL (`resolveReviewThread`); `gh pr` can't resolve threads.
