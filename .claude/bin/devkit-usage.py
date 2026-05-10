#!/usr/bin/env python3
"""devkit-usage: token-usage aggregator for the ringkas-devkit statusline.

Split-cache design for reactive statusline updates:

  - context_tokens      : fresh every call (tail current session's JSONL)
  - session_tokens      : cached 10s (5h rolling window — changes every turn)
  - window_5h_tokens    : alias of session_tokens
  - window_7d_tokens    : cached 10s alongside 5h (both come from the same pass)

Each Claude Code session has its own <session_id>.jsonl under
~/.claude/projects/, so context is computed by tailing that one file
instead of scanning every transcript.

Usage: devkit-usage.py <session_id> [--no-cache]
"""

import json
import os
import sys
import time
import glob
from pathlib import Path
from datetime import datetime, timezone, timedelta

CACHE_DIR = Path("/tmp")
WINDOW_CACHE_TTL_SEC = 5
TAIL_BYTES = 2 * 1024 * 1024  # 2 MB is enough for any single turn


def _discover_search_roots():
    """Directories to glob for *.jsonl transcripts.

    Supports multiple Claude CLIs that share the Anthropic transcript format:
      - Vanilla Claude Code  ~/.claude/projects/
      - CCS                  ~/.ccs/shared/context-groups/<group>/projects/

    Extra paths can be added via DEVKIT_TRANSCRIPT_PATHS (colon-separated).
    """
    roots = []
    claude_dir = Path.home() / ".claude" / "projects"
    if claude_dir.is_dir():
        roots.append(claude_dir)

    ccs_base = Path.home() / ".ccs" / "shared" / "context-groups"
    if ccs_base.is_dir():
        try:
            for group in ccs_base.iterdir():
                proj = group / "projects"
                if proj.is_dir():
                    roots.append(proj)
        except OSError:
            pass

    for p in os.environ.get("DEVKIT_TRANSCRIPT_PATHS", "").split(":"):
        p = p.strip()
        if p and Path(p).is_dir():
            roots.append(Path(p))

    return roots


SEARCH_ROOTS = _discover_search_roots()


def parse_ts(ts_str):
    if not ts_str:
        return None
    try:
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


def total_tokens(usage):
    if not isinstance(usage, dict):
        return 0
    return (
        usage.get("input_tokens", 0)
        + usage.get("output_tokens", 0)
        + usage.get("cache_creation_input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0)
    )


def context_tokens_of(usage):
    """Tokens occupying the context window (exclude output — it's not in-context)."""
    if not isinstance(usage, dict):
        return 0
    return (
        usage.get("input_tokens", 0)
        + usage.get("cache_creation_input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0)
    )


# ── Context (fresh, per-call) ────────────────────────────────────────

def find_session_file(session_id):
    if not session_id:
        return None
    matches = []
    for root in SEARCH_ROOTS:
        matches.extend(glob.glob(str(root / "**" / f"{session_id}.jsonl"), recursive=True))
    if not matches:
        return None
    return max(matches, key=os.path.getmtime)


def tail_context_tokens(session_id):
    """Read only the last TAIL_BYTES of the session file and find the most
    recent usage entry. Returns (context_tokens, session_total_tokens_in_tail).
    The second number is approximate (bounded by the tail window)."""
    path = find_session_file(session_id)
    if not path:
        return 0, 0

    try:
        size = os.path.getsize(path)
        with open(path, "rb") as fh:
            if size > TAIL_BYTES:
                fh.seek(size - TAIL_BYTES)
                fh.readline()  # discard partial first line
            data = fh.read()
    except OSError:
        return 0, 0

    text = data.decode("utf-8", errors="ignore")

    last_ctx = 0
    last_ts = None
    total_in_tail = 0

    for line in text.splitlines():
        if '"usage"' not in line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = entry.get("message") or {}
        usage = msg.get("usage")
        if not usage:
            continue

        total_in_tail += total_tokens(usage)

        ts = parse_ts(entry.get("timestamp"))
        if ts and (last_ts is None or ts > last_ts):
            last_ts = ts
            last_ctx = context_tokens_of(usage)

    return last_ctx, total_in_tail


# ── Windows (cached 10s) ────────────────────────────────────────────

def compute_windows():
    now = datetime.now(timezone.utc)
    cutoff_5h = now - timedelta(hours=5)
    cutoff_7d = now - timedelta(days=7)
    cutoff_7d_ts = cutoff_7d.timestamp()

    w5 = 0
    w7 = 0

    if not SEARCH_ROOTS:
        return w5, w7

    paths = []
    for root in SEARCH_ROOTS:
        paths.extend(glob.iglob(str(root / "**" / "*.jsonl"), recursive=True))

    for jsonl_path in paths:
        try:
            if os.path.getmtime(jsonl_path) < cutoff_7d_ts:
                continue
        except OSError:
            continue

        try:
            with open(jsonl_path, "r", encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if '"usage"' not in line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = entry.get("message") or {}
                    usage = msg.get("usage")
                    if not usage:
                        continue
                    ts = parse_ts(entry.get("timestamp"))
                    if ts is None:
                        continue
                    tok = total_tokens(usage)
                    if ts >= cutoff_7d:
                        w7 += tok
                    if ts >= cutoff_5h:
                        w5 += tok
        except OSError:
            continue

    return w5, w7


def cached_windows(no_cache=False):
    cache_file = CACHE_DIR / "devkit-usage-windows.json"
    now = time.time()

    if not no_cache and cache_file.is_file():
        try:
            age = now - cache_file.stat().st_mtime
            if age < WINDOW_CACHE_TTL_SEC:
                with open(cache_file, "r", encoding="utf-8") as fh:
                    d = json.load(fh)
                    return d.get("w5", 0), d.get("w7", 0)
        except (OSError, json.JSONDecodeError):
            pass

    w5, w7 = compute_windows()
    try:
        tmp = cache_file.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"w5": w5, "w7": w7}, fh)
        os.replace(tmp, cache_file)
    except OSError:
        pass
    return w5, w7


# ── Entry point ─────────────────────────────────────────────────────

def main():
    argv = sys.argv[1:]
    no_cache = "--no-cache" in argv
    argv = [a for a in argv if a != "--no-cache"]
    session_id = argv[0] if argv else ""

    ctx, _tail_total = tail_context_tokens(session_id)
    w5, w7 = cached_windows(no_cache=no_cache)

    # Monotonic frame index for statusline animation (8 frames, ~125ms each)
    frame = int(time.time() * 8) % 8

    json.dump({
        "context_tokens": ctx,
        "session_tokens": w5,      # kept for back-compat
        "window_5h_tokens": w5,
        "window_7d_tokens": w7,
        "frame": frame,
    }, sys.stdout)


if __name__ == "__main__":
    main()
