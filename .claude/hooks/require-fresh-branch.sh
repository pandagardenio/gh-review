#!/bin/bash
# Hook: PreToolUse on Edit|Write — on the first edit of a session, verify HEAD is on a
# feature branch cut from origin/main (or an accepted release branch).
# Writes a sentinel to .claude/session/ so subsequent edits skip the check.
# Exit 2 = block; exit 0 = allow.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SESSION_DIR="$PROJECT_DIR/.claude/session"
SENTINEL="$SESSION_DIR/branch-verified"

# Skip if already verified this session
if [ -f "$SENTINEL" ]; then
  exit 0
fi

# Consume (and ignore) stdin so Claude Code's hook runner is happy
cat >/dev/null

CURRENT_BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Block if on main/master
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  cat >&2 <<EOF
BLOCKED: you are on '$CURRENT_BRANCH'. Cut a fresh feature branch before editing:

  git checkout main && git pull && git checkout -b <type>/<slug>

where <type> is one of: feat, fix, chore, refactor, test, docs.
EOF
  exit 2
fi

# Accept release/* branches as a base
if [[ "$CURRENT_BRANCH" == release/* ]]; then
  mkdir -p "$SESSION_DIR"
  : > "$SENTINEL"
  exit 0
fi

# Otherwise verify the branch has an upstream cut from origin/main
UPSTREAM=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo "")

# If upstream is configured, accept it (standard feature-branch shape)
if [ -n "$UPSTREAM" ]; then
  mkdir -p "$SESSION_DIR"
  : > "$SENTINEL"
  exit 0
fi

# No upstream yet — check the branch's merge-base is on origin/main
if git -C "$PROJECT_DIR" rev-parse --verify origin/main >/dev/null 2>&1; then
  MERGE_BASE=$(git -C "$PROJECT_DIR" merge-base HEAD origin/main 2>/dev/null || echo "")
  if [ -z "$MERGE_BASE" ]; then
    cat >&2 <<EOF
BLOCKED: branch '$CURRENT_BRANCH' has no common history with origin/main. Cut a fresh branch:

  git checkout main && git pull && git checkout -b <type>/<slug>
EOF
    exit 2
  fi
fi

mkdir -p "$SESSION_DIR"
: > "$SENTINEL"
exit 0
