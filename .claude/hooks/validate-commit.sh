#!/bin/bash
# Hook: PreToolUse on Bash — blocks direct commits on main and --no-verify.
# Exit 2 = block the tool call; exit 0 = allow.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only care about git commit commands
if ! echo "$COMMAND" | grep -qE '(^|[[:space:]])git[[:space:]]+commit'; then
  exit 0
fi

# --no-verify is never allowed, regardless of branch or directory.
if echo "$COMMAND" | grep -q -- '--no-verify'; then
  echo "BLOCKED: --no-verify is not allowed. The pre-commit hook must run." >&2
  exit 2
fi

# Resolve the directory the commit will ACTUALLY run in, so a commit made in a
# worktree (or a sibling repo's worktree) is checked against THAT repo's branch
# — not the hook process's cwd. Precedence: explicit `git -C <dir>` > leading
# `cd <dir> &&` > hook `cwd` input.
TARGET_DIR=$(printf '%s' "$COMMAND" \
  | sed -nE "s/.*git[[:space:]]+-C[[:space:]]+['\"]?([^'\"[:space:]]+).*/\1/p" | head -1)
if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR=$(printf '%s' "$COMMAND" \
    | sed -nE "s/^[[:space:]]*cd[[:space:]]+['\"]?([^'\"&;|]+).*/\1/p" | head -1 \
    | sed -E 's/[[:space:]]+$//')
fi
if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
fi
[ -z "$TARGET_DIR" ] && TARGET_DIR="$PWD"

CURRENT_BRANCH=$(git -C "$TARGET_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "BLOCKED: Direct commits on $CURRENT_BRANCH are not allowed. Cut a feature branch first: git checkout -b <type>/<slug>." >&2
  exit 2
fi

exit 0
