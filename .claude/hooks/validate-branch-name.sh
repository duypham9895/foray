#!/bin/bash
# PreToolUse:Bash — enforces foray branch naming.
# Per CLAUDE.md §5: feat/<topic>, fix/<topic>, chore/<topic>, docs/<topic>

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — branch name validation skipped." >&2
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -qE "git (checkout -b|switch -c)"; then
  exit 0
fi

BRANCH=$(echo "$COMMAND" | grep -oE "(checkout -b|switch -c)\s+\S+" | awk '{print $NF}')
[ -z "$BRANCH" ] && exit 0

VALID="feat|fix|chore|docs"
PATTERN="^($VALID)/[a-z0-9][a-z0-9._-]*$"

if ! echo "$BRANCH" | grep -qE "$PATTERN"; then
  echo "Invalid branch name: '$BRANCH'" >&2
  echo "Required format: <type>/<topic>     (CLAUDE.md §5)" >&2
  echo "  Valid types:  feat, fix, chore, docs" >&2
  echo "  Topic:        lowercase letters, digits, dots, hyphens, underscores" >&2
  echo "Examples:" >&2
  echo "  feat/gmail-poller" >&2
  echo "  fix/matcher-false-positive" >&2
  echo "  chore/upgrade-prisma" >&2
  echo "  docs/architecture-update" >&2
  exit 1
fi

echo "Branch '$BRANCH' is valid." >&2
exit 0
