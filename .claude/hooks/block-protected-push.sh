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

# ── Escape hatch: FORAY_ALLOW_PUSH_MAIN=1 ──────────────────────────
# Allows direct push to a protected branch when the user has explicitly
# authorized it. Reads both the hook process env AND the command string
# (Claude Code's hook may not propagate inline VAR=val env to children).
# --force is still blocked above — this only relaxes the protected-branch
# check, never force-push.
ALLOW=0
[ "${FORAY_ALLOW_PUSH_MAIN:-0}" = "1" ] && ALLOW=1
case "$COMMAND" in
  *"FORAY_ALLOW_PUSH_MAIN=1"*) ALLOW=1 ;;
  *"FORAY_ALLOW_PUSH_MAIN=true"*) ALLOW=1 ;;
esac

for b in $PROTECTED_BRANCHES; do
  if [ "$TARGET" = "$b" ]; then
    if [ "$ALLOW" = "1" ]; then
      hook_log "$HOOK" allowed "push to $b via FORAY_ALLOW_PUSH_MAIN"
      exit 0
    fi
    REASON="Direct push to protected branch \"$b\" is forbidden.
Command: $COMMAND

Foray workflow: changes to main go through a PR.
  1. Push your feature branch:  git push -u origin <your-branch>
  2. Open PR targeting main:    gh pr create

To override (only when the user explicitly asks):
  FORAY_ALLOW_PUSH_MAIN=1 git push origin $b"
    hook_log "$HOOK" blocked "direct push to $b"
    emit_pretooluse_deny "$REASON"
    exit 0
  fi
done

hook_log "$HOOK" allowed ""
exit 0
