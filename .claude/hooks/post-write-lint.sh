#!/bin/bash
# PostToolUse:Write|Edit — lint the just-edited file.
# Foray uses pnpm + ESLint for TS/TSX/JS/JSX.
# Skips other extensions (e.g., .md, .json, .prisma).

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — post-write lint skipped." >&2
  exit 0
fi

PAYLOAD=$(cat)
FILE=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"
ERRORS=0

case "$EXT" in
  ts|tsx|js|jsx|cjs|mjs)
    # Augment PATH for GUI-launched Claude Code (no shell rc loaded)
    PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/Library/pnpm:$HOME/.local/share/pnpm:$HOME/.bun/bin"
    if command -v npx &>/dev/null; then
      echo "Linting $FILE with ESLint..." >&2
      npx --no-install eslint --max-warnings 0 "$FILE" >&2 || ERRORS=1
    else
      echo "Warning: npx not found — $FILE not linted. Install Node.js to enable ESLint." >&2
    fi
    ;;
  *)
    exit 0
    ;;
esac

if [ "$ERRORS" -ne 0 ]; then
  echo "Lint errors in $FILE. Fix before continuing." >&2
  exit 1
fi

exit 0
