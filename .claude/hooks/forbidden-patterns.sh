#!/bin/bash
# Hook: PreToolUse on Edit|Write — enforces rules from .claude/rules/forbidden-patterns.json.
# Exit 2 = block; exit 0 = allow.
#
# Rule types:
#   path-block        — pathRegex matches → block
#   line-cap          — pathRegex matches AND content exceeds maxLines → block
#   content-forbidden — pathRegex matches AND (no contentGuard OR contentGuard matches)
#                       AND regex matches content → block
#   content-required  — pathRegex matches AND contentGuard matches
#                       AND mustContain regex is absent from content → block

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
RULES_FILE="$PROJECT_DIR/.claude/rules/forbidden-patterns.json"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [ ! -f "$RULES_FILE" ]; then
  # No rules file → no enforcement
  exit 0
fi

# Validate JSON up front; fail closed on parse error
if ! jq -e '.rules' "$RULES_FILE" >/dev/null 2>&1; then
  echo "BLOCKED: forbidden-patterns.json is invalid JSON or missing .rules" >&2
  exit 2
fi

VIOLATIONS=""

# Iterate rules as base64-encoded JSON lines to preserve embedded quotes/newlines
while IFS= read -r encoded; do
  RULE=$(echo "$encoded" | base64 --decode)
  ID=$(echo "$RULE" | jq -r '.id // "unknown"')
  TYPE=$(echo "$RULE" | jq -r '.type // empty')
  PATH_RE=$(echo "$RULE" | jq -r '.pathRegex // empty')
  PATH_EXCLUDE=$(echo "$RULE" | jq -r '.pathExclude // empty')
  MSG=$(echo "$RULE" | jq -r '.message // empty')

  # Path filter — skip rule if file doesn't match pathRegex (when specified)
  if [ -n "$PATH_RE" ] && ! [[ "$FILE_PATH" =~ $PATH_RE ]]; then
    continue
  fi
  # Path exclusion — skip rule if file matches pathExclude (when specified)
  if [ -n "$PATH_EXCLUDE" ] && [[ "$FILE_PATH" =~ $PATH_EXCLUDE ]]; then
    continue
  fi

  case "$TYPE" in
    path-block)
      VIOLATIONS="${VIOLATIONS}
- [${ID}] ${MSG}"
      ;;

    line-cap)
      MAX=$(echo "$RULE" | jq -r '.maxLines // 0')
      if [ "$MAX" -gt 0 ] && [ -n "$NEW_CONTENT" ]; then
        LINES=$(echo "$NEW_CONTENT" | wc -l | tr -d ' ')
        if [ "$LINES" -gt "$MAX" ]; then
          VIOLATIONS="${VIOLATIONS}
- [${ID}] ${MSG} (got ${LINES} lines, cap ${MAX})"
        fi
      fi
      ;;

    content-forbidden)
      if [ -z "$NEW_CONTENT" ]; then
        continue
      fi
      GUARD=$(echo "$RULE" | jq -r '.contentGuard // empty')
      REGEX=$(echo "$RULE" | jq -r '.regex // empty')
      FLATTEN=$(echo "$RULE" | jq -r '.flatten // false')
      if [ -n "$GUARD" ] && ! echo "$NEW_CONTENT" | grep -qE "$GUARD"; then
        continue
      fi
      if [ -n "$REGEX" ]; then
        if [ "$FLATTEN" = "true" ]; then
          if echo "$NEW_CONTENT" | tr '\n' ' ' | grep -qE "$REGEX"; then
            VIOLATIONS="${VIOLATIONS}
- [${ID}] ${MSG}"
          fi
        elif echo "$NEW_CONTENT" | grep -qE "$REGEX"; then
          VIOLATIONS="${VIOLATIONS}
- [${ID}] ${MSG}"
        fi
      fi
      ;;

    content-required)
      if [ -z "$NEW_CONTENT" ]; then
        continue
      fi
      GUARD=$(echo "$RULE" | jq -r '.contentGuard // empty')
      MUST=$(echo "$RULE" | jq -r '.mustContain // empty')
      if [ -n "$GUARD" ] && ! echo "$NEW_CONTENT" | grep -qE "$GUARD"; then
        continue
      fi
      if [ -n "$MUST" ] && ! echo "$NEW_CONTENT" | grep -qE "$MUST"; then
        VIOLATIONS="${VIOLATIONS}
- [${ID}] ${MSG}"
      fi
      ;;

    *)
      # Unknown type → skip, but flag loudly to stderr (helps debugging rule authoring)
      echo "forbidden-patterns.sh: unknown rule type '$TYPE' for rule '$ID'" >&2
      ;;
  esac
done < <(jq -r '.rules[] | @base64' "$RULES_FILE")

if [ -n "$VIOLATIONS" ]; then
  echo "BLOCKED — Triage rule violations:${VIOLATIONS}" >&2
  echo "" >&2
  echo "See .claude/rules/forbidden-patterns.json and CLAUDE.md for details." >&2
  exit 2
fi

exit 0
