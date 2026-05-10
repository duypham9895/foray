#!/usr/bin/env bash
# Shared helpers for foray hooks. Sourced, not executed.
# Adapted from ringkas-devkit (beli).

_foray_hook_log_file() {
  local base
  base="${HOOK_LOG_FILE:-${CLAUDE_PROJECT_DIR:-$PWD}/.claude/.devkit/hook-log.jsonl}"
  printf '%s' "$base"
}

hook_log() {
  command -v jq >/dev/null 2>&1 || return 0
  local file
  file="$(_foray_hook_log_file)"
  local dir="${file%/*}"
  mkdir -p "$dir" 2>/dev/null || return 0
  jq -nc \
    --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg hook "$1" \
    --arg verdict "$2" \
    --arg reason "$3" \
    '{ts:$ts, hook:$hook, verdict:$verdict, reason:$reason}' \
    >> "$file" 2>/dev/null || return 0
  if [ -f "$file" ]; then
    tail -n 500 "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || true
  fi
}

emit_posttooluse() {
  jq -nc --arg msg "$1" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
}

emit_pretooluse_deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
}
