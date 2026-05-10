#!/bin/bash
# PreToolUse:Bash — enforces foray commit message format.
# Per CLAUDE.md §6:
#   - Subject ≤72 chars
#   - Present-tense verb-led, lowercase first word
#   - No trailing period
#   - No `Co-Authored-By` for AI agents (override with FORAY_ALLOW_COAUTHOR=1)

if ! command -v jq &>/dev/null; then
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

# Extract -m argument (single or double quoted, or HEREDOC subject)
MSG=$(echo "$COMMAND" | sed -n "s/.*-m '\([^']*\)'.*/\1/p" | head -1)
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
fi

# Co-Authored-By check operates on the WHOLE command (HEREDOC bodies included)
if [ "${FORAY_ALLOW_COAUTHOR:-0}" != "1" ]; then
  if echo "$COMMAND" | grep -qiE 'co-authored-by:.*claude|co-authored-by:.*anthropic|co-authored-by:.*ai|co-authored-by:.*gpt|co-authored-by:.*assistant'; then
    echo "Commit blocked: contains AI Co-Authored-By trailer." >&2
    echo "CLAUDE.md §6: 'Never include Co-Authored-By for AI agents unless explicitly asked.'" >&2
    echo "Either remove the trailer, or set FORAY_ALLOW_COAUTHOR=1 if the user explicitly asked for it." >&2
    exit 1
  fi
fi

# Subject-line checks only run if we extracted one
[ -z "$MSG" ] && exit 0

# Length check: ≤72 chars
LEN=${#MSG}
if [ "$LEN" -gt 72 ]; then
  echo "Commit subject too long: $LEN chars (max 72)." >&2
  echo "Subject: $MSG" >&2
  echo "CLAUDE.md §6: Subject ≤72 chars, body for details." >&2
  exit 1
fi

# Lowercase first letter
# Use POSIX class [[:lower:]] not [a-z] — macOS bash 3.2 [a-z] matches uppercase
# due to locale collation. See: https://unix.stackexchange.com/q/15140
FIRST="${MSG:0:1}"
case "$FIRST" in
  [[:lower:]]) ;;
  *)
    echo "Commit subject must start with a lowercase letter." >&2
    echo "Subject: $MSG" >&2
    echo "CLAUDE.md §6: 'present-tense, verb-led, lowercase first word'." >&2
    echo "Examples: 'add gmail polling cron', 'fix matcher false-positive'" >&2
    exit 1
    ;;
esac

# No trailing period
case "$MSG" in
  *.)
    echo "Commit subject must not end with a period." >&2
    echo "Subject: $MSG" >&2
    exit 1
    ;;
esac

echo "Commit message is valid." >&2
exit 0
