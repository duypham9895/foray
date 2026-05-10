#!/usr/bin/env bash
# PreToolUse:Bash — run tests before `git push`. Block on failure.
#
# Foray uses pnpm + vitest. Detects script `test:run` (single-pass).
#
# Escape hatches:
#   - export DEVKIT_PREPUSH_SKIP=1
#   - prefix the command: `DEVKIT_PREPUSH_SKIP=1 git push ...`
#   - touch .claude/.devkit/prepush-skip
#
# Timeout default: 90s (override via DEVKIT_PREPUSH_TIMEOUT).
# Adapted from ringkas-devkit.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/_lib.sh"

HOOK="pre-push-tests"

PAYLOAD=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

case "$COMMAND" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

# ── Escape hatches ────────────────────────────────────────────────
SKIP=0
[ "${DEVKIT_PREPUSH_SKIP:-0}" = "1" ] && SKIP=1
case "$COMMAND" in
  *"DEVKIT_PREPUSH_SKIP=1"*) SKIP=1 ;;
  *"DEVKIT_PREPUSH_SKIP=true"*) SKIP=1 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$ROOT" || exit 0

[ -f ".claude/.devkit/prepush-skip" ] && SKIP=1

if [ "$SKIP" = "1" ]; then
  hook_log "$HOOK" allowed "skipped via DEVKIT_PREPUSH_SKIP or prepush-skip flag"
  exit 0
fi

TIMEOUT="${DEVKIT_PREPUSH_TIMEOUT:-90}"

deny() {
  hook_log "$HOOK" blocked "$1"
  emit_pretooluse_deny "$1"
  exit 0
}

# ── Augment PATH ──────────────────────────────────────────────────
augment_path() {
  local extra
  extra="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin"
  extra="$extra:$HOME/.volta/bin"
  extra="$extra:$HOME/.local/share/pnpm"
  extra="$extra:$HOME/Library/pnpm"
  extra="$extra:$HOME/.local/share/fnm/aliases/default/bin"
  extra="$extra:$HOME/.fnm/aliases/default/bin"
  extra="$extra:$HOME/.asdf/shims"
  extra="$extra:$HOME/.bun/bin"
  PATH="$PATH:$extra"
  export PATH
}
augment_path

# ── Detect test command (foray uses pnpm + test:run) ──────────────
TEST_CMD=""
TEST_LABEL=""
RUNNER_BIN="pnpm"

if [ -f "package.json" ]; then
  for script in test:run test:fast test:quick test; do
    if jq -e ".scripts[\"$script\"]" package.json >/dev/null 2>&1; then
      TEST_CMD="pnpm run --silent $script"
      TEST_LABEL="pnpm $script"
      break
    fi
  done
fi

if [ -z "$TEST_CMD" ]; then
  hook_log "$HOOK" allowed "no test script detected"
  exit 0
fi

# ── Fail-OPEN if pnpm isn't reachable ─────────────────────────────
if ! command -v "$RUNNER_BIN" >/dev/null 2>&1; then
  warning_msg="WARNING: pre-push-tests can't find 'pnpm' on PATH.
Skipping the test run — the push will go through.

Fix: launch Claude Code from a terminal where pnpm is on PATH, or
touch .claude/.devkit/prepush-skip to silence this hook permanently."
  hook_log "$HOOK" allowed "runner 'pnpm' not on PATH — failing open"
  printf '%s\n' "$warning_msg" >&2
  exit 0
fi

# ── Run with timeout ──────────────────────────────────────────────
echo "Running tests before push: $TEST_LABEL (timeout ${TIMEOUT}s — set DEVKIT_PREPUSH_SKIP=1 to skip)" >&2

run_with_timeout() {
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout "${TIMEOUT}s" bash -c "$TEST_CMD"
  elif command -v timeout >/dev/null 2>&1; then
    timeout "${TIMEOUT}s" bash -c "$TEST_CMD"
  else
    bash -c "$TEST_CMD" &
    local pid=$!
    (sleep "$TIMEOUT" && kill -TERM "$pid" 2>/dev/null) &
    local watcher=$!
    if wait "$pid"; then
      kill -TERM "$watcher" 2>/dev/null
      wait "$watcher" 2>/dev/null
      return 0
    else
      local rc=$?
      kill -TERM "$watcher" 2>/dev/null
      wait "$watcher" 2>/dev/null
      if ! kill -0 "$pid" 2>/dev/null; then
        return "$rc"
      fi
      return 124
    fi
  fi
}

TMPOUT=$(mktemp -t foray-prepush.XXXXXX)
set +e
run_with_timeout > "$TMPOUT" 2>&1
RC=$?
set -e

if [ "$RC" = 0 ]; then
  hook_log "$HOOK" allowed "tests passed ($TEST_LABEL)"
  rm -f "$TMPOUT"
  exit 0
fi

OUTPUT=$(tail -n 40 "$TMPOUT" 2>/dev/null)
rm -f "$TMPOUT"

if [ "$RC" = 127 ]; then
  warning_msg="WARNING: pre-push-tests ran '$TEST_CMD' but got exit 127.
Skipping — likely PATH issue. Last output:
$OUTPUT"
  hook_log "$HOOK" allowed "exit 127 — failing open"
  printf '%s\n' "$warning_msg" >&2
  exit 0
fi

if [ "$RC" = 124 ]; then
  deny "Tests timed out after ${TIMEOUT}s ($TEST_LABEL). Push blocked.
Last output:
$OUTPUT

If this is expected (slow suite, you're pushing WIP):
  DEVKIT_PREPUSH_SKIP=1 git push ...
…or touch .claude/.devkit/prepush-skip to silence permanently."
fi

deny "Tests failed ($TEST_LABEL, exit $RC). Push blocked.
Last output:
$OUTPUT

Fix the failing tests before pushing. If you must push WIP:
  DEVKIT_PREPUSH_SKIP=1 git push ...
…or touch .claude/.devkit/prepush-skip to silence permanently."
