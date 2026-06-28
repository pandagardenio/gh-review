#!/bin/bash
# Hook: Stop — end-of-session SDLC for Triage: Biome lint, typecheck, affected tests,
# then a PR prompt. Block-everything mode (per project setup): any failure exits 2 so
# the session can't close on red. Escape hatches:
#   TRIAGE_SKIP_CLOSE=1  — skip the gate entirely (e.g. WIP/spikes).
#   TRIAGE_SOFT=1        — report failures but don't block (exit 0).

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

# Consume stdin (Stop hooks receive session JSON we don't need here)
cat >/dev/null

[ "${TRIAGE_SKIP_CLOSE:-0}" = "1" ] && exit 0

SOFT="${TRIAGE_SOFT:-0}"
SECTION() { printf '\n── %s ──\n' "$1" >&2; }
GREEN()   { printf '  ✓ %s\n' "$1" >&2; }
RED()     { printf '  ✗ %s\n' "$1" >&2; }
INFO()    { printf '  • %s\n' "$1" >&2; }

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Skip if not on a working branch (detached HEAD or main/master — nothing to gate)
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ] || [ -z "$CURRENT_BRANCH" ]; then
  exit 0
fi

# Pick the best base ref for "what changed", mirroring the pre-push hook.
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE="origin/main"
elif git rev-parse --verify main >/dev/null 2>&1; then
  BASE="main"
else
  BASE="HEAD^"
fi

CHANGED_ANY=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || true)
if [ -z "$CHANGED_ANY" ]; then
  SECTION "session close"
  INFO "no changes vs. $BASE — nothing to gate."
  exit 0
fi

FAILED=0

SECTION "pnpm lint (Biome)"
if pnpm lint >/tmp/triage-lint.log 2>&1; then
  GREEN "lint + format clean"
else
  RED "lint failed — see /tmp/triage-lint.log"
  FAILED=1
fi

SECTION "pnpm typecheck"
if pnpm typecheck >/tmp/triage-typecheck.log 2>&1; then
  GREEN "typecheck clean"
else
  RED "typecheck failed — see /tmp/triage-typecheck.log"
  FAILED=1
fi

SECTION "affected tests (turbo ...[$BASE])"
if pnpm exec turbo run test --filter="...[$BASE]" >/tmp/triage-test.log 2>&1; then
  GREEN "tests passed"
else
  RED "tests failed — see /tmp/triage-test.log"
  FAILED=1
fi

SECTION "PR"
AHEAD=$(git rev-list --count "$BASE"..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" -eq 0 ]; then
  INFO "no commits ahead of $BASE — nothing to PR yet."
elif [ "$FAILED" -eq 0 ]; then
  INFO "$AHEAD commit(s) ahead of $BASE, all checks green. Run '/pr' to open a PR (creates it, watches CI, then the review loop)."
else
  INFO "$AHEAD commit(s) ahead of $BASE, but checks failed. Fix first, then '/pr'."
fi

if [ "$FAILED" -eq 1 ] && [ "$SOFT" != "1" ]; then
  echo "" >&2
  echo "Session close blocked — fix the failures above (or set TRIAGE_SOFT=1 to downgrade to a warning)." >&2
  exit 2
fi

exit 0
