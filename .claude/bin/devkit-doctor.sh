#!/usr/bin/env bash
# devkit-doctor — diagnose which statusLine Claude Code is actually using
# and why the devkit statusline may not be appearing.
#
# Usage: .claude/bin/devkit-doctor.sh
set -u

C_BOLD=$'\033[1m'
C_OK=$'\033[32m'
C_WARN=$'\033[33m'
C_ERR=$'\033[31m'
C_DIM=$'\033[2m'
C_RESET=$'\033[0m'

say()  { printf '%b\n' "$*"; }
hdr()  { say "${C_BOLD}== $* ==${C_RESET}"; }
ok()   { say "  ${C_OK}✓${C_RESET} $*"; }
warn() { say "  ${C_WARN}!${C_RESET} $*"; }
err()  { say "  ${C_ERR}✗${C_RESET} $*"; }
info() { say "  ${C_DIM}·${C_RESET} $*"; }

# ── Locate project root ────────────────────────────────────────────
PROJECT="$(pwd)"
while [ "$PROJECT" != "/" ] && [ ! -d "$PROJECT/.claude" ]; do
  PROJECT="$(dirname "$PROJECT")"
done
if [ ! -d "$PROJECT/.claude" ]; then
  err "No .claude/ found walking up from $(pwd). Run install.sh first."
  exit 1
fi
hdr "Project: $PROJECT"

# ── Settings files and statusLine declarations ─────────────────────
hdr "statusLine declarations (highest precedence wins)"
for f in \
  "$PROJECT/.claude/settings.local.json" \
  "$PROJECT/.claude/settings.json" \
  "$HOME/.claude/settings.json"; do
  if [ -f "$f" ]; then
    sl=$(jq -r '.statusLine.command // empty' "$f" 2>/dev/null)
    if [ -n "$sl" ]; then
      ok "$f → $sl"
    else
      info "$f (no statusLine)"
    fi
  else
    info "$f (absent)"
  fi
done

# The active one is the highest-priority file with a statusLine.
ACTIVE=""
for f in \
  "$PROJECT/.claude/settings.local.json" \
  "$PROJECT/.claude/settings.json" \
  "$HOME/.claude/settings.json"; do
  if [ -f "$f" ]; then
    sl=$(jq -r '.statusLine.command // empty' "$f" 2>/dev/null)
    if [ -n "$sl" ]; then ACTIVE="$sl"; ACTIVE_FROM="$f"; break; fi
  fi
done
if [ -n "$ACTIVE" ]; then
  say "${C_BOLD}Active statusLine:${C_RESET} $ACTIVE (from $ACTIVE_FROM)"
  if printf '%s' "$ACTIVE" | grep -q devkit-statusline; then
    ok "devkit statusline is active"
  else
    err "Devkit statusline is NOT active. A higher-precedence setting wins."
    warn "Fix: re-run install.sh — it writes .claude/settings.local.json which beats user settings."
  fi
else
  err "No statusLine configured anywhere."
fi

# ── Required binaries ──────────────────────────────────────────────
hdr "Dependencies"
for c in jq python3 git; do
  if command -v "$c" >/dev/null 2>&1; then ok "$c: $($c --version 2>&1 | head -1)"; else err "$c missing"; fi
done

# ── Devkit bin ─────────────────────────────────────────────────────
hdr "Devkit scripts"
for f in devkit-statusline.sh devkit-usage.py; do
  p="$PROJECT/.claude/bin/$f"
  if [ -x "$p" ]; then ok "$f ($(stat -f '%Sm' "$p"))"
  elif [ -f "$p" ]; then warn "$f exists but not executable"
  else err "$f missing"; fi
done

# ── Plan file ──────────────────────────────────────────────────────
hdr "Plan budgets (.claude/devkit-plan.json)"
PLAN="$PROJECT/.claude/devkit-plan.json"
if [ -f "$PLAN" ]; then
  s=$(jq -r '.session_tokens' "$PLAN" 2>/dev/null)
  w=$(jq -r '.weekly_tokens' "$PLAN" 2>/dev/null)
  ok "session_tokens=$s  weekly_tokens=$w"
else
  warn "Missing. Using built-in defaults (Max 5x)."
fi

# ── Dry-run the statusline ─────────────────────────────────────────
hdr "Dry-run (2 consecutive calls — frames should differ)"
SESSION_ID="$(find ~/.claude/projects -name "*.jsonl" -mmin -5 2>/dev/null | head -1 | xargs -I {} basename {} .jsonl 2>/dev/null)"
[ -z "$SESSION_ID" ] && SESSION_ID="test-session"
INPUT='{"session_id":"'"$SESSION_ID"'","model":{"id":"claude-opus-4-7","display_name":"Opus 4.7 (1M context)"},"workspace":{"current_dir":"'"$PROJECT"'","project_dir":"'"$PROJECT"'"},"cwd":"'"$PROJECT"'"}'
for i in 1 2; do
  printf '  %d: ' "$i"
  echo "$INPUT" | bash "$PROJECT/.claude/bin/devkit-statusline.sh" 2>/dev/null
  echo
  sleep 0.15
done

# ── Raw token counts (so you can sanity-check and calibrate budgets) ──
hdr "Raw usage (session used for dry-run: $SESSION_ID)"
rm -f /tmp/devkit-usage-windows.json 2>/dev/null  # force fresh
RAW=$(python3 "$PROJECT/.claude/bin/devkit-usage.py" "$SESSION_ID" 2>/dev/null)
if [ -n "$RAW" ]; then
  ctx=$(printf '%s' "$RAW" | jq -r '.context_tokens')
  w5=$(printf  '%s' "$RAW" | jq -r '.window_5h_tokens')
  w7=$(printf  '%s' "$RAW" | jq -r '.window_7d_tokens')
  fmt_k() { awk -v n="$1" 'BEGIN { if(n>=1000000)printf "%.1fM", n/1000000; else if(n>=1000)printf "%.0fK", n/1000; else print n }'; }
  info "context_tokens    = $(fmt_k "$ctx")  (current session, last turn)"
  info "window_5h_tokens  = $(fmt_k "$w5")   (all sessions, rolling 5h)"
  info "window_7d_tokens  = $(fmt_k "$w7")   (all sessions, rolling 7d)"
  # Suggest budgets that place the user at ~50% so the bar has headroom
  sug5=$(awk -v n="$w5" 'BEGIN { v=n*2; printf "%d", v }')
  sug7=$(awk -v n="$w7" 'BEGIN { v=n*2; printf "%d", v }')
  info "if these bars look too empty, try session_tokens=$sug5 weekly_tokens=$sug7 in .claude/devkit-plan.json"
fi

# ── Caches ─────────────────────────────────────────────────────────
hdr "Caches (/tmp)"
ls -la /tmp/devkit-usage-*.json 2>/dev/null | sed 's/^/  /' || info "none"

# ── Cross-tab rate-limit sync ──────────────────────────────────────
hdr "Cross-tab rate-limit cache (/tmp/devkit-rate-limits.json)"
SHARED=/tmp/devkit-rate-limits.json
if [ -f "$SHARED" ]; then
  ts=$(jq -r '.ts // 0' "$SHARED" 2>/dev/null)
  age=$(( $(date +%s) - ts ))
  fh=$(jq -r '.five_hour' "$SHARED" 2>/dev/null)
  sd=$(jq -r '.seven_day' "$SHARED" 2>/dev/null)
  info "five_hour=${fh}  seven_day=${sd}  written ${age}s ago"
  if [ "$age" -lt 300 ]; then
    ok "fresh — any active tab will use these values"
  else
    warn "stale (>5min) — will be ignored; falls back to per-tab stdin"
  fi
else
  info "absent — will be created on next render with native rate_limits"
fi

# ── Live instrumentation: what is Claude Code actually passing? ────
hdr "Last stdin seen by statusline (/tmp/devkit-statusline-last-input.json)"
LAST_IN="/tmp/devkit-statusline-last-input.json"
if [ -f "$LAST_IN" ]; then
  mtime_str="$(stat -f '%Sm' "$LAST_IN" 2>/dev/null || stat -c '%y' "$LAST_IN" 2>/dev/null)"
  info "captured $mtime_str"
  SESS="$(jq -r '.session_id // empty' "$LAST_IN" 2>/dev/null)"
  CWD_IN="$(jq -r '.workspace.current_dir // .cwd // empty' "$LAST_IN" 2>/dev/null)"
  MODEL="$(jq -r '.model.display_name // empty' "$LAST_IN" 2>/dev/null)"
  info "session_id = ${SESS:-<missing>}"
  info "cwd        = ${CWD_IN:-<missing>}"
  info "model      = ${MODEL:-<missing>}"

  # Data-source breakdown per metric
  NCTX="$(jq -r '.context_window.used_percentage // empty' "$LAST_IN" 2>/dev/null)"
  N5H="$(jq  -r '.rate_limits.five_hour.used_percentage // empty' "$LAST_IN" 2>/dev/null)"
  N7D="$(jq  -r '.rate_limits.seven_day.used_percentage // empty' "$LAST_IN" 2>/dev/null)"
  if [ -n "$NCTX" ]; then ok "ctx:  using native .context_window.used_percentage (${NCTX}%)"
  else info "ctx:  falling back to transcript-parsing (no native field in stdin)"; fi
  if [ -n "$N5H" ]; then ok "sess: using native .rate_limits.five_hour.used_percentage (${N5H}%) — matches Anthropic's /usage"
  else info "sess: falling back to transcript aggregation vs devkit-plan.json budget (estimate)"; fi
  if [ -n "$N7D" ]; then ok "week: using native .rate_limits.seven_day.used_percentage (${N7D}%) — matches Anthropic's /usage"
  else info "week: falling back to transcript aggregation vs devkit-plan.json budget (estimate)"; fi
  if [ -n "$SESS" ]; then
    MATCH="$(find "$HOME/.claude/projects" "$HOME/.ccs/shared/context-groups" -name "${SESS}.jsonl" 2>/dev/null | head -1)"
    if [ -n "$MATCH" ]; then
      ok "transcript found: $MATCH"
      lines="$(wc -l < "$MATCH" 2>/dev/null | tr -d ' ')"
      usages="$(grep -c '"usage"' "$MATCH" 2>/dev/null)"
      mod="$(stat -f '%Sm' "$MATCH" 2>/dev/null || stat -c '%y' "$MATCH" 2>/dev/null)"
      info "lines=$lines usage_entries=$usages last_mod=$mod"
    else
      err "no transcript file matches session_id=$SESS"
      warn "ctx % will be 0 until Claude Code writes a usage entry for this session."
    fi
  fi
else
  warn "No stdin captured yet. Has Claude Code invoked the statusline this session?"
  info "After restarting Claude Code + chatting once, re-run this doctor."
fi

# ── Invocation log: how often does Claude Code call the statusline? ──
hdr "Invocation log (/tmp/devkit-statusline.log)"
LOG="/tmp/devkit-statusline.log"
if [ -f "$LOG" ]; then
  total="$(wc -l < "$LOG" 2>/dev/null | tr -d ' ')"
  info "total recent invocations tracked: $total (capped at 50)"
  say "  last 5:"
  tail -5 "$LOG" 2>/dev/null | sed 's/^/    /'
else
  warn "No log yet."
fi

# ── Hook activity log ──────────────────────────────────────────────
hdr "Hook activity (.claude/.devkit/hook-log.jsonl)"
HOOK_LOG="$PROJECT/.claude/.devkit/hook-log.jsonl"
if [ -f "$HOOK_LOG" ]; then
  total="$(wc -l < "$HOOK_LOG" 2>/dev/null | tr -d ' ')"
  blocked="$(grep -c '"verdict":"blocked"' "$HOOK_LOG" 2>/dev/null || echo 0)"
  info "entries: $total  blocks recorded: $blocked  (log capped at 500)"
  say "  last 20:"
  tail -n 20 "$HOOK_LOG" 2>/dev/null | while IFS= read -r line; do
    ts=$(printf '%s' "$line" | jq -r '.ts // ""' 2>/dev/null)
    hook=$(printf '%s' "$line" | jq -r '.hook // ""' 2>/dev/null)
    verdict=$(printf '%s' "$line" | jq -r '.verdict // ""' 2>/dev/null)
    reason=$(printf '%s' "$line" | jq -r '.reason // ""' 2>/dev/null)
    case "$verdict" in
      blocked) icon="${C_ERR}✗${C_RESET}" ;;
      allowed) icon="${C_OK}✓${C_RESET}" ;;
      *)       icon="${C_DIM}·${C_RESET}" ;;
    esac
    printf '    %b %s  %-28s %s%s\n' "$icon" "${ts#*T}" "$hook" "$verdict" "${reason:+  — $reason}"
  done
else
  info "no hook activity logged yet — log appears after first hook fires"
fi

say ""
say "${C_DIM}To force-refresh numbers: rm -f /tmp/devkit-usage-*.json${C_RESET}"
say "${C_DIM}To disable animation:     export DEVKIT_STATUSLINE_ANIMATE=0${C_RESET}"
say "${C_DIM}To clear instrumentation: rm -f /tmp/devkit-statusline*.{log,json}${C_RESET}"
say "${C_DIM}To clear hook log:        rm -f $PROJECT/.claude/.devkit/hook-log.jsonl${C_RESET}"
