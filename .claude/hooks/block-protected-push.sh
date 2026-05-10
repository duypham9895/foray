#!/usr/bin/env bash
# PreToolUse:Bash — block direct pushes to protected branches.
#
# Foray protected branches: main only (no develop/uat/qc).
# Always blocks --force / --force-with-lease anywhere.
#
# Adapted from ringkas-devkit.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/_lib.sh"
HOOK="block-protected-push"

PROTECTED_BRANCHES="main master"

PAYLOAD=$(cat)
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)
else
  exit 0
fi
[ -z "$COMMAND" ] && exit 0

case "$COMMAND" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

# ── Always block --force / --force-with-lease ──────────────────────
if printf '%s' "$COMMAND" | grep -qE -- '(--force-with-lease|--force|[[:space:]]-f([[:space:]]|$))'; then
  REASON="Force-push detected. Command: $COMMAND
Force-pushing rewrites history. Never run this without explicit user consent.
If the user asked for it, have them run it themselves."
  hook_log "$HOOK" blocked "force-push"
  emit_pretooluse_deny "$REASON"
  exit 0
fi

# ── Determine target branch ────────────────────────────────────────
TARGET=""
TAIL="${COMMAND##*git push}"
# shellcheck disable=SC2086
set -- $TAIL
POS=()
for tok in "$@"; do
  case "$tok" in
    -*) ;;
    *) POS+=("$tok") ;;
  esac
done
if [ "${#POS[@]}" -ge 2 ]; then
  TARGET="${POS[1]}"
  case "$TARGET" in
    *:*) TARGET="${TARGET##*:}" ;;
  esac
  case "$TARGET" in
    refs/heads/*) TARGET="${TARGET#refs/heads/}" ;;
    HEAD) TARGET="" ;;
  esac
fi

if [ -z "$TARGET" ]; then
  TARGET=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
fi

[ -z "$TARGET" ] && exit 0

for b in $PROTECTED_BRANCHES; do
  if [ "$TARGET" = "$b" ]; then
    REASON="Direct push to protected branch \"$b\" is forbidden.
Command: $COMMAND

Foray workflow: changes to main go through a PR.
  1. Push your feature branch:  git push -u origin <your-branch>
  2. Open PR targeting main:    gh pr create

If there's a legitimate emergency, the engineer (not the agent) should run the push manually."
    hook_log "$HOOK" blocked "direct push to $b"
    emit_pretooluse_deny "$REASON"
    exit 0
  fi
done

hook_log "$HOOK" allowed ""
exit 0
