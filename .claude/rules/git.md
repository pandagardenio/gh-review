# Git rules

## Always use `gh` CLI

For any GitHub interaction — PRs, issues, branches, releases, checks — use the `gh` CLI. Never the web UI, never the REST API directly (except where GraphQL is required, e.g. resolving review threads below).

## Commits

Format: `type: <emoji> description`.

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.

Emoji: your personal emoji from `CLAUDE.local.md` (gitignored). If the file is absent, ask the user which emoji to use, then create it.

```
feat: 🐼 add .diff loader with REST API fallback
fix: 🐼 keep CSP error from being mislabelled "PR too large"
chore: 🐼 bump turbo to 2.10
refactor: 🐼 split categorizer into path + dependency halves
test: 🐼 cover token-store round-trip
docs: 🐼 document the engine/ui split in CLAUDE.md
```

Rules:
- Short subject (≤70 chars), English, imperative ("add" not "added").
- Never `--no-verify` — `validate-commit.sh` blocks it.
- Never directly on `main`/`master` — `validate-commit.sh` blocks it.
- This environment also requires the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` on commit messages.

## Branching

- **Fresh branch from `main`** for every task. `require-fresh-branch.sh` enforces this before the first edit.
  ```
  git checkout main && git pull && git checkout -b <type>/<slug>
  ```
- `release/*` branches are also accepted as a base.
- Branch names follow the commit-type convention: `feat/diff-loader`, `fix/csp-error-label`, `chore/bump-turbo`.
- Dogfood the thesis: land work in **small PRs scoped by category** (one backlog item per PR where possible) so the tool stays reviewable with the tool.

## Pull Requests

ALWAYS use `gh` CLI:

```bash
gh pr create --title "type: <emoji> description" --body "$(cat <<'EOF'
## 💡 Summary
* What does this PR do?
* Why is this needed? (link the backlog item, e.g. BL-00X)

## 📝 Notes
* Constitution principle served / strained (principles 2 and 4 need explicit justification)

## 🧪 How to test
* Step 1
* Step 2
EOF
)"
```

Rules:
- PR title follows the commit convention (`type: <emoji> description`).
- Fill in all three sections. "How to test" must have at least one concrete step.
- Link the backlog item the PR closes.
- Base branch: usually `main`.
- End the PR body with the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` trailer (per this environment).

## PR watch loop

After `gh pr create` (or an update):

```bash
gh pr checks <number> --watch
gh pr view <number> --json mergeable,mergeStateStatus
```

Rules:
- Poll until all checks pass AND `mergeable` is not `CONFLICTING`.
- On CI failure: read the failing log, fix the issue, commit, push, resume watching.
- On merge conflicts: rebase on the base branch, resolve, push, resume watching.
- Stop only when: all green AND no conflicts. Report: "PR #N — all checks passed, no conflicts."

## PR review phase

Once the PR is open and CI is green, it enters a **self-review phase** before a human looks at it. Catch the obvious issues yourself, in the open, as resolvable review threads.

1. **Review.** Run `/code-review --comment` against the open PR. It posts each finding as an inline comment, opening a resolvable thread per finding.
2. **Triage.** Read every comment. Each is actionable (a real fix) or not. Never silently drop an actionable one.
3. **Fix.** Address every actionable finding. Group related fixes into a focused commit (`fix: <emoji> address PR review — <summary>`).
4. **Repush.** Push to the PR branch; CI re-runs — fold back into the watch loop until green.
5. **Resolve.** Resolve each addressed thread, replying with a one-line pointer to the fix. For one you won't action, reply with the reason — then resolve, or leave open if it needs the human's call. Never resolve silently.
6. **Repeat** until no unresolved actionable comments and CI is green.

### Resolving threads with `gh` (requires GraphQL)

```bash
# List unresolved review threads
gh api graphql -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$pr){
        reviewThreads(first:100){
          nodes{ id isResolved comments(first:1){ nodes{ body path } } }
        }
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F pr=<number>

# Reply to a thread, then resolve it by node id
gh api repos/<owner>/<repo>/pulls/<number>/comments/<comment-id>/replies -f body='Fixed in <sha>.'
gh api graphql -f query='
  mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' \
  -F id=<thread-node-id>
```

Stop only when: CI is green, and every actionable review comment is fixed-and-resolved or has a recorded reason. Report: `"PR #N — reviewed, M comments addressed, all resolved, CI green."`

## Merge conflict resolution

1. Analyze the conflict — what each side changed and why.
2. Resolve directly — don't prompt for approval before resolving.
3. Prefer rebase over merge commits (linear history).
4. Re-run lint + tests after resolving, before committing.
5. Report a concise summary of what changed and why (which files, which side kept, behavioural implications) so the user can correct it.
