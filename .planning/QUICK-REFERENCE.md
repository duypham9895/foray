# Autonomous Execution — Quick Reference

**Print this. Use with PHASE-MANIFEST.md and STATE.md.**

---

## Key Files

| File | Purpose | When to Read |
|---|---|---|
| `PHASE-MANIFEST.md` | Global phase mapping (1–16+), authoritative source | Always — before running any phase |
| `STATE.md` | Current progress, milestone status, continuity | Session start |
| `LEAN-ROADMAP.md` | Lean milestone details (phases 1–5) | Reviewing Lean goals |
| `PHASE_COMPLETION_CHECKLIST.md` | Verification steps at phase end | Phase completes |

---

## Command Syntax

**Global phase numbering** (phases 1–16, not per-milestone):

```bash
# Start a specific phase (Lean: 01-05, Standard: 06-10, Full: 11-16)
/gsd-autonomous --from 01    # Phase 1 (Foundation + Auth)
/gsd-autonomous --from 06    # Phase 6 (Bookmarklet + Capture API)
/gsd-autonomous --from 11    # Phase 11 (Chrome MV3 Extension)

# Resume from specific plan
/gsd-autonomous --from 06-02  # Phase 6, Plan 02

# Resume from specific task
/gsd-autonomous --from 06-02 --task 3

# Run full milestone at once (auto-advance between phases)
/gsd-autonomous --from 01 --continue --auto-advance  # Lean: 01→05
/gsd-autonomous --from 06 --continue --auto-advance  # Standard: 06→10
/gsd-autonomous --from 11 --continue --auto-advance  # Full: 11→16
```

---

## Phase Mapping (Continuous Numbering)

### Lean Milestone (v0.1) — Phases 1–5
```
01 → Foundation + Auth
02 → Applications Slice
03 → Classifier + Matcher
04 → Gmail Ingestion + Pipeline
05 → Review Queue + Acceptance
```

### Standard Milestone (v0.2) — Phases 6–10
```
06 → Bookmarklet + Capture API
07 → Today Dashboard
08 → Tags + Search
09 → UX Polish + Keyboard Shortcuts
10 → E2E Tests + Acceptance
```

### Full Milestone (v0.3) — Phases 11–16
```
11 → Chrome MV3 Extension
12 → Document Storage
13 → Recruiter Entity
14 → Google Calendar Integration
15 → Analytics Dashboard
16 → Reminders + Polish
```

### Future — Phase 17+
```
17 → Multi-LLM Provider Abstraction
```

---

## Check Progress

```bash
# Current status
cat .planning/STATE.md

# See phase details
cat .planning/phases/NN-*/RESEARCH.md        # Architecture + rationale
cat .planning/phases/NN-*/REQUIREMENTS.md    # Specs + success criteria
cat .planning/phases/NN-*/NN-0M-PLAN.md      # Executable tasks

# Git log of work
git log --oneline -20

# Phase completion checklist
cat .planning/PHASE_COMPLETION_CHECKLIST.md
```

---

## Transition Points

### After Phase 5 Complete (Lean → Standard)
```bash
# Verify Lean complete
cat .planning/PHASE_COMPLETION_CHECKLIST.md

# Start Standard Phase 1 (Bookmarklet)
/gsd-autonomous --from 06 --continue --auto-advance
```

### After Phase 10 Complete (Standard → Full)
```bash
# Verify Standard complete (E2E tests passing)
pnpm test:e2e

# Start Full Phase 1 (Chrome Extension)
/gsd-autonomous --from 11 --continue --auto-advance
```

---

## File Structure

```
.planning/
├── PHASE-MANIFEST.md           ← Master reference: all phases 1–16+
├── STATE.md                    ← Current progress + continuity
├── LEAN-ROADMAP.md             ← Lean milestone goals (phases 1–5)
├── PHASE_COMPLETION_CHECKLIST.md
├── phases/
│   ├── 01-foundation-auth/
│   │   ├── 01-01-PLAN.md       ← Executable tasks
│   │   ├── 01-02-PLAN.md
│   │   ├── RESEARCH.md         ← Architecture + rationale
│   │   └── REQUIREMENTS.md     ← Specs + success criteria
│   ├── 02-applications-slice-manual-tracker/
│   ├── ...
│   └── 17-multi-llm-provider-abstraction/
└── research/
    ├── SUMMARY.md
    ├── ARCHITECTURE.md
    └── ...
```

---

## Cheat Sheet

| Task | Command |
|---|---|
| See all phases | `cat .planning/PHASE-MANIFEST.md` |
| Resume Phase 5 Plan 03 | `/gsd-autonomous --from 05-03` |
| Start Standard milestone | `/gsd-autonomous --from 06 --continue --auto-advance` |
| Check what's blocked | `cat .planning/STATE.md` |
| Run phase tests | `pnpm test:run` |
| Pre-commit check | `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` |
| See recent commits | `git log --oneline -10` |

---

*Quick reference v2.0 (global phase numbering) — updated 2026-05-09*
