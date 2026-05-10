#!/usr/bin/env bash
# devkit-statusline — Claude Code statusline for ringkas-devkit.
# Reads JSON from stdin, emits one animated formatted line.
#
# Shows:
#   [project]⠋ branch | Model·thinkTier | ctx ████░░░░ 42% | sess … | week …
#
# Animation:
#   - 8-frame braille spinner advances on every statusline refresh (~300ms).
#   - Progress bars for ctx / sess / week with threshold colors.
#   Disable animation: export DEVKIT_STATUSLINE_ANIMATE=0
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PY_HELPER="${SCRIPT_DIR}/devkit-usage.py"

# ── Read statusline JSON from stdin ────────────────────────────────
PAYLOAD="$(cat)"

# ── Instrumentation: always-on, cheap. Helps devkit-doctor diagnose. ──
# Stash latest stdin + append one-line invocation record (last 50 kept).
DEBUG_INPUT="/tmp/devkit-statusline-last-input.json"
DEBUG_LOG="/tmp/devkit-statusline.log"
printf '%s' "$PAYLOAD" > "$DEBUG_INPUT" 2>/dev/null || true
{
  printf '%s pid=%s ppid=%s\n' "$(date '+%F %T')" "$$" "$PPID"
} >> "$DEBUG_LOG" 2>/dev/null || true
# Trim log: keep last 50 lines
if [ -f "$DEBUG_LOG" ]; then
  tail -n 50 "$DEBUG_LOG" > "${DEBUG_LOG}.tmp" 2>/dev/null && mv "${DEBUG_LOG}.tmp" "$DEBUG_LOG" 2>/dev/null || true
fi

json_get() {
  printf '%s' "$PAYLOAD" | jq -r "$1 // empty" 2>/dev/null || true
}

SESSION_ID="$(json_get '.session_id')"
MODEL_DISPLAY="$(json_get '.model.display_name')"
MODEL_ID="$(json_get '.model.id')"
CWD="$(json_get '.workspace.current_dir')"
[ -z "$CWD" ] && CWD="$(json_get '.cwd')"
[ -z "$CWD" ] && CWD="$PWD"
PROJECT_DIR="$(json_get '.workspace.project_dir')"
[ -z "$PROJECT_DIR" ] && PROJECT_DIR="$CWD"

PROJECT_NAME="$(basename "$PROJECT_DIR")"

# ── Native rate-limit fields (CCS and newer Claude Code expose these) ──
# If present, we use them as-is — they're the real Anthropic numbers.
# Otherwise fall back to transcript-parsing aggregation.
NATIVE_CTX_PCT="$(json_get '.context_window.used_percentage')"
NATIVE_5H_PCT="$(json_get  '.rate_limits.five_hour.used_percentage')"
NATIVE_7D_PCT="$(json_get  '.rate_limits.seven_day.used_percentage')"
NATIVE_CTX_SIZE="$(json_get '.context_window.context_window_size')"

# ── Git branch (best-effort, fast) ─────────────────────────────────
BRANCH=""
if [ -d "$PROJECT_DIR/.git" ] || git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH="$(git -C "$PROJECT_DIR" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  [ -z "$BRANCH" ] && BRANCH="$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || true)"
fi

# ── Thinking tier (from MAX_THINKING_TOKENS) ───────────────────────
THINK_TIER=""
if [ -n "${MAX_THINKING_TOKENS:-}" ] && [ "${MAX_THINKING_TOKENS}" -gt 0 ] 2>/dev/null; then
  if   [ "$MAX_THINKING_TOKENS" -le 5000  ]; then THINK_TIER="low"
  elif [ "$MAX_THINKING_TOKENS" -le 20000 ]; then THINK_TIER="med"
  else THINK_TIER="high"
  fi
fi

# ── Context window size ────────────────────────────────────────────
# Prefer stdin's context_window.context_window_size, else infer from model name.
if [ -n "$NATIVE_CTX_SIZE" ] && [ "$NATIVE_CTX_SIZE" -gt 0 ] 2>/dev/null; then
  CTX_MAX="$NATIVE_CTX_SIZE"
else
  CTX_MAX=200000
  case "$MODEL_DISPLAY $MODEL_ID" in
    *1M*|*1m*) CTX_MAX=1000000 ;;
  esac
fi
if [ -n "${CLAUDE_CONTEXT_MAX:-}" ] && [ "$CLAUDE_CONTEXT_MAX" -gt 0 ] 2>/dev/null; then
  CTX_MAX="$CLAUDE_CONTEXT_MAX"
fi

# ── Plan limits ────────────────────────────────────────────────────
PLAN_FILE=""
for candidate in \
  "$CWD/.claude/devkit-plan.json" \
  "$PROJECT_DIR/.claude/devkit-plan.json" \
  "$HOME/.claude/devkit-plan.json"; do
  if [ -f "$candidate" ]; then
    PLAN_FILE="$candidate"
    break
  fi
done

SESSION_BUDGET=44000000
WEEKLY_BUDGET=880000000
if [ -n "$PLAN_FILE" ]; then
  v="$(jq -r '.session_tokens // empty' "$PLAN_FILE" 2>/dev/null)"
  [ -n "$v" ] && SESSION_BUDGET="$v"
  v="$(jq -r '.weekly_tokens // empty' "$PLAN_FILE" 2>/dev/null)"
  [ -n "$v" ] && WEEKLY_BUDGET="$v"
fi

# ── Aggregate usage via Python helper (fallback + frame counter) ───
# We always run the helper because we need `frame` for the spinner, and
# the fallback window numbers in case stdin lacks native rate-limit data.
USAGE_JSON='{}'
if command -v python3 >/dev/null 2>&1 && [ -f "$PY_HELPER" ]; then
  USAGE_JSON="$(python3 "$PY_HELPER" "$SESSION_ID" 2>/dev/null || echo '{}')"
fi

get_n() { printf '%s' "$USAGE_JSON" | jq -r "$1 // 0" 2>/dev/null || echo 0; }
CTX_TOK="$(get_n '.context_tokens')"
W5H_TOK="$(get_n '.window_5h_tokens')"
W7D_TOK="$(get_n '.window_7d_tokens')"

# ── Per-invocation frame counter ───────────────────────────────────
# Advances one per statusline call so animation never repeats the same
# frame twice in a row, regardless of Claude Code's refresh cadence.
FRAME_FILE="/tmp/devkit-statusline-frame.count"
FRAME=0
if [ -f "$FRAME_FILE" ]; then
  FRAME=$(cat "$FRAME_FILE" 2>/dev/null)
  FRAME=$(( (FRAME + 1) % 8 ))
fi
printf '%s' "$FRAME" > "$FRAME_FILE" 2>/dev/null || true

# pct10 returns percent * 10 as an integer — e.g. 11.4% -> 114.
# Lets us format decimals and thresholds without shelling out to awk twice.
pct10() {
  local used="$1" max="$2"
  [ "$max" -eq 0 ] 2>/dev/null && { echo 0; return; }
  awk -v u="$used" -v m="$max" 'BEGIN { p=(u*1000)/m; if(p>9999)p=9999; printf "%d", p }'
}

# Convert a native percent value (possibly integer like "32" or float like
# "14.000000000000002") to percent*10 as an integer. Bash arithmetic can't
# handle decimals, so we route through awk.
native_pct10() {
  awk -v v="$1" 'BEGIN { printf "%d", (v * 10) + 0.5 }'
}

# ctx: ALWAYS use transcript tail — native .context_window.used_percentage
# from CCS rounds to integers (10K-token jumps on 1M), while the transcript
# gives us decimal precision that visibly moves every turn.
CTX_PCT10="$(pct10 "$CTX_TOK" "$CTX_MAX")"

# ── Cross-tab rate-limit sync (Option A: latest-write-wins, 5-min TTL) ──
# Every tab's CCS has its own rate-limit cache with different staleness.
# We publish our observed native values to a shared file and prefer whichever
# values were written most recently across all tabs. This means an active tab
# in another terminal that just got fresh CCS data will lift all other active
# tabs' statuslines too. Idle tabs can't be helped — Claude Code won't re-
# invoke their statusline without user activity.
SHARED_RL_FILE="/tmp/devkit-rate-limits.json"
SHARED_RL_TTL=300
NOW_EPOCH="$(date +%s)"

# Publish our values if we have them
if [ -n "$NATIVE_5H_PCT" ] || [ -n "$NATIVE_7D_PCT" ]; then
  printf '{"ts":%s,"five_hour":%s,"seven_day":%s}' \
    "$NOW_EPOCH" \
    "${NATIVE_5H_PCT:-null}" \
    "${NATIVE_7D_PCT:-null}" \
    > "${SHARED_RL_FILE}.tmp" 2>/dev/null
  mv -f "${SHARED_RL_FILE}.tmp" "$SHARED_RL_FILE" 2>/dev/null || true
fi

# Read back — use whichever is in shared (may be us, may be another tab's
# more-recent write). Fall through if shared is stale.
if [ -f "$SHARED_RL_FILE" ]; then
  SHARED_TS="$(jq -r '.ts // 0' "$SHARED_RL_FILE" 2>/dev/null || echo 0)"
  SHARED_AGE=$(( NOW_EPOCH - SHARED_TS ))
  if [ "$SHARED_AGE" -lt "$SHARED_RL_TTL" ] 2>/dev/null; then
    SHARED_5H="$(jq -r '.five_hour // empty' "$SHARED_RL_FILE" 2>/dev/null)"
    SHARED_7D="$(jq -r '.seven_day // empty' "$SHARED_RL_FILE" 2>/dev/null)"
    [ -n "$SHARED_5H" ] && [ "$SHARED_5H" != "null" ] && NATIVE_5H_PCT="$SHARED_5H"
    [ -n "$SHARED_7D" ] && [ "$SHARED_7D" != "null" ] && NATIVE_7D_PCT="$SHARED_7D"
  fi
fi

# sess / week: prefer native rate-limit fields (they match Anthropic's /usage).
# Native values are cached by CCS and refresh slowly — that's a CCS concern,
# not fixable here. Fall back to transcript aggregation vs plan budget only
# when the CLI doesn't expose rate-limit fields at all.
if [ -n "$NATIVE_5H_PCT" ]; then
  SESS_PCT10="$(native_pct10 "$NATIVE_5H_PCT")"
  SESS_SRC="native"
else
  SESS_PCT10="$(pct10 "$W5H_TOK" "$SESSION_BUDGET")"
  SESS_SRC="estimate"
fi

if [ -n "$NATIVE_7D_PCT" ]; then
  WEEK_PCT10="$(native_pct10 "$NATIVE_7D_PCT")"
  WEEK_SRC="native"
else
  WEEK_PCT10="$(pct10 "$W7D_TOK" "$WEEKLY_BUDGET")"
  WEEK_SRC="estimate"
fi

# Integer percent for color thresholds
CTX_PCT=$((CTX_PCT10 / 10))
SESS_PCT=$((SESS_PCT10 / 10))
WEEK_PCT=$((WEEK_PCT10 / 10))

# Formatted decimal percent string, e.g. "11.4"
fmt_pct() {
  local p10="$1"
  printf '%d.%d' $((p10/10)) $((p10%10))
}

# ── ANSI + glyphs ──────────────────────────────────────────────────
DIM=$'\033[2m'
RESET=$'\033[0m'
BOLD=$'\033[1m'
CYAN=$'\033[36m'
ITALIC=$'\033[3m'

# 256-color gradient from green (safe) to red (danger). Index = pct/10.
COLOR_GRADIENT=(40 46 82 118 154 190 226 214 208 202 196)
EMPTY_COLOR=238   # dim gray for unfilled bar
CAP_COLOR=244    # soft gray for rounded bar caps
SPINNER_COLOR=87 # soft cyan

color_for_pct() {
  local pct="$1"
  [ "$pct" -lt 0 ] 2>/dev/null && pct=0
  [ "$pct" -gt 100 ] 2>/dev/null && pct=100
  local idx=$(( pct / 10 ))
  [ "$idx" -gt 10 ] && idx=10
  printf '%s' "${COLOR_GRADIENT[$idx]}"
}

# Emit SGR code for a 256-color foreground.
fg256()     { printf '\033[38;5;%sm' "$1"; }
fg256bold() { printf '\033[1;38;5;%sm' "$1"; }
fg256dim()  { printf '\033[2;38;5;%sm' "$1"; }

ANIMATE="${DEVKIT_STATUSLINE_ANIMATE:-1}"
SPINNER_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧')
SUB_GLYPHS=('░' '▏' '▎' '▍' '▌' '▋' '▊' '▉')

# Fancy progress bar — 8 chars wide, each with 8 sub-block fill levels
# (64 visible resolution steps). Colors:
#   - filled: 11-step gradient green→red based on overall percent
#   - scan shimmer: one filled block each frame rendered bold to create a
#     subtle sweeping highlight across the filled area (animation off → absent)
#   - trailing sub-block: same hue as the rest, 1/8-step precision
#   - empty tail: dim gray for low contrast so the filled part pops
#   - caps: ▕ and ▏ in soft gray, hinting at a rounded track
bar() {
  local p10="$1" width=8
  [ "$p10" -lt 0 ] 2>/dev/null && p10=0
  [ "$p10" -gt 1000 ] 2>/dev/null && p10=1000
  local subunits=$(( p10 * width * 8 / 1000 ))
  local full=$(( subunits / 8 ))
  local frac=$(( subunits % 8 ))
  local empty=$(( width - full - (frac>0?1:0) ))
  [ "$empty" -lt 0 ] && empty=0

  local pct=$(( p10 / 10 ))
  local base_color; base_color="$(color_for_pct "$pct")"

  local scan_pos=-1
  if [ "$ANIMATE" = "1" ] && [ "$full" -gt 1 ]; then
    scan_pos=$(( FRAME % full ))
  fi

  local FG  FG_BRIGHT FG_EMPTY CAP
  FG="$(fg256 "$base_color")"
  FG_BRIGHT="$(fg256bold "$base_color")"
  FG_EMPTY="$(fg256dim "$EMPTY_COLOR")"
  CAP="$(fg256dim "$CAP_COLOR")"

  local out="${CAP}▕${RESET}"
  local i
  for (( i=0; i<full; i++ )); do
    if [ "$i" -eq "$scan_pos" ]; then
      out+="${FG_BRIGHT}█${RESET}"
    else
      out+="${FG}█${RESET}"
    fi
  done
  if [ "$frac" -gt 0 ]; then
    out+="${FG}${SUB_GLYPHS[$frac]}${RESET}"
  fi
  for (( i=0; i<empty; i++ )); do
    out+="${FG_EMPTY}░${RESET}"
  done
  out+="${CAP}▏${RESET}"
  printf '%s' "$out"
}

# Colored decimal percent — matches bar hue for instant visual pairing.
fmt_pct_colored() {
  local p10="$1"
  local pct=$(( p10 / 10 ))
  local color; color="$(color_for_pct "$pct")"
  printf '%s%s%%%s' "$(fg256 "$color")" "$(fmt_pct "$p10")" "$RESET"
}

# ── Spinner with breathing color pulse ─────────────────────────────
# Two independent cycles:
#   - glyph cycles through 8 braille frames every call (already animated)
#   - color breathes through a 256-color cyan palette so it "glows"
SPINNER_PULSE=(51 87 123 159 195 159 123 87)  # breathing cyan
SPINNER=""
if [ "$ANIMATE" = "1" ]; then
  SPINNER_GLYPH="${SPINNER_FRAMES[$FRAME]}"
  SPINNER_HUE="${SPINNER_PULSE[$FRAME]}"
  SPINNER="$(fg256bold "$SPINNER_HUE")${SPINNER_GLYPH}${RESET}"
fi

# Soft dotted divider — sits more quietly between sections than │
SEP="$(fg256dim 240)⋅${RESET}"

# ── Model label ────────────────────────────────────────────────────
MODEL_LABEL="${MODEL_DISPLAY:-${MODEL_ID:-claude}}"
if [ -n "$THINK_TIER" ]; then
  MODEL_LABEL="${MODEL_LABEL}${DIM}·${RESET}${CYAN}think:${THINK_TIER}${RESET}"
fi

# ── Compose ────────────────────────────────────────────────────────
BRANCH_PART=""
[ -n "$BRANCH" ] && BRANCH_PART=" ${DIM}${ITALIC}${BRANCH}${RESET}"

SPINNER_PART=""
[ -n "$SPINNER" ] && SPINNER_PART="${SPINNER} "

# Project name: dim brackets, bold cyan name
PROJECT_PART="$(fg256dim "$CAP_COLOR")[${RESET}$(fg256 117)${BOLD}${PROJECT_NAME}${RESET}$(fg256dim "$CAP_COLOR")]${RESET}"

LABEL="$(fg256dim 245)"  # muted gray for ctx/sess/week labels
printf '%s%s%s %s %s %s %sctx%s %s %s %s %ssess%s %s %s %s %sweek%s %s %s' \
  "$SPINNER_PART" \
  "$PROJECT_PART" \
  "$BRANCH_PART" \
  "$SEP" "$MODEL_LABEL" \
  "$SEP" "$LABEL" "$RESET" "$(bar "$CTX_PCT10")"  "$(fmt_pct_colored "$CTX_PCT10")" \
  "$SEP" "$LABEL" "$RESET" "$(bar "$SESS_PCT10")" "$(fmt_pct_colored "$SESS_PCT10")" \
  "$SEP" "$LABEL" "$RESET" "$(bar "$WEEK_PCT10")" "$(fmt_pct_colored "$WEEK_PCT10")"
