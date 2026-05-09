---
title: Phase Completion Checklist
description: Required updates when a phase execution is complete, ensuring data consistency across all docs
version: 1.0
created: 2026-05-09
---

# Phase Completion Checklist

**When a phase is verified and execution complete, update these files in order:**

## 1. Main Documentation Files (external visibility first)

### 1a. README.md (Roadmap table)

- [ ] Update Lean milestone status row in the Roadmap table:
  - If phases 1+ complete but Lean not finished: `🔨 In progress (Phase X/5)`
  - Example: `🔨 In progress (Phase 4/5)` when executing Phase 4
  - When Lean complete: `✅ Complete`

### 1b. docs/milestones/lean.md (Status line)

- [ ] Update status line near top:
  - When executing: `🔨 In progress — Phases X–Y complete, Phase Z executing`
  - Example: `🔨 In progress — Phases 1–3 complete, Phase 4 executing`
  - When complete: `✅ Complete (verified YYYY-MM-DD)`

## 2. Status File (`.planning/STATE.md`)

- [ ] Update YAML header:
  - `last_updated: "YYYY-MM-DDTHH:MM:00.000Z"` (current timestamp)
  - `completed_phases: X` (increment by 1)
  - If this was the last plan in the phase: `completed_plans: Y` (update to reflect all plans done)
  - `percent: Z` (recalculate: `(completed_plans / total_plans * 100)`)
  - `status:` set to `executing` if moving to next phase, else `planning`

- [ ] Update Current Position section:
  - `Phase: X of 5` → next phase number
  - Update phase status display: ✅ Complete → ✅ Complete (with date), ⏳ Pending → ⏳ Executing
  - Update Progress bar: `[▰▰▰⠀⠀]` to reflect X phases complete

- [ ] Update Performance Metrics table:
  - `Phases completed: X/5`
  - `Phases in progress: X/5` (if applicable)
  - Add row for completed phase with completion date

- [ ] Update Open Todos:
  - Remove todos for completed phase
  - Add todos for next phase if entering execution

- [ ] Update Session Continuity table:
  - Add row for completed phase with artifact count
  - Mark as ✅ Complete with verification date
  - Update "Next action" to point to next phase's first plan

## 2. Main Documentation Files

### 2a. README.md (Roadmap table)

- [ ] Update Lean milestone status row:
  - `**Lean** | 🔨 In progress (Phase X/5) | …` (when phases 1+ complete but not all)
  - `**Lean** | ✅ Complete | …` (when all 5 phases complete)
  - Example progression: "Not started" → "In progress (Phase 2/5)" → "In progress (Phase 4/5)" → "Complete"

### 2b. docs/milestones/lean.md (Status line)

- [ ] Update status line at top:
  - Current: `**Status**: ⏳ Pending Lean`
  - After Lean phase complete: `**Status**: 🔨 In progress — Phases X–Y complete, Phase Z executing`
  - When Lean done: `**Status**: ✅ Complete (verified YYYY-MM-DD)`

### 2c. Landing Page (`landing/index.html`)

- [ ] Update build status line in Roadmap section:
  - Change: `Phases X–Y complete. Phase Z currently in progress.`
  - Example: `Phases 1–4 complete. Phase 5 currently in progress.`

## 3. Project Memory (`.ccs/instances/work/projects/.../memory/`)

- [ ] Update or create phase status file (e.g., `phase-X-status.md`):
  - Update completion status table
  - Mark phase as ✅ COMPLETE with date
  - Update "Next action" to point to next phase

- [ ] Update `MEMORY.md` index:
  - Move completed phase memory to top (most relevant)
  - Update description to reflect completion date

## 4. Git Commit (coordinate all updates)

- [ ] Create a single commit with **ALL** updated files:
  ```bash
  git add README.md docs/milestones/lean.md .planning/STATE.md landing/index.html .ccs/instances/work/projects/.../memory/
  git commit -m "docs: mark Phase X complete, advance to Phase Y

  Updated external visibility:
  - README.md: Lean milestone status updated to reflect phase progress
  - docs/milestones/lean.md: Status line updated with phase info
  - landing/index.html: Build status indicator updated
  
  Updated internal tracking:
  - STATE.md: Phase X verified, progress metrics, phase status
  - Memory: phase-X-status.md completion date

  Phase X artifacts: (N files - N plans + N summaries + verification + etc.)
  Phase Y status: Planning complete, ready to execute
  
  Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
  ```

## 5. Optional: Update `.planning/ROADMAP.md`

- [ ] If ROADMAP.md has phase status checkboxes, update them
- [ ] If ROADMAP.md references current phase, update that

## Verification

**Before marking complete, verify:**
- [ ] Verification file exists (`.planning/phases/0X-*/0X-VERIFICATION.md`)
- [ ] All 4 summary files exist for the phase (0X-01-SUMMARY through 0X-0Y-SUMMARY)
- [ ] All required artifacts are in the phase directory
- [ ] STATE.md shows correct phase status and progress %
- [ ] Landing page build status reflects accurate phase count
- [ ] Memory files are updated with completion date

## Example: After Phase 4 Complete

```
STATE.md header:
  completed_phases: 4
  completed_plans: 24  (5+5+5+5 = 20, plus any extra phase 5 plans)
  percent: 100 or X% (depending on phase 5 plans)

Landing page:
  "Phases 1–4 complete. Phase 5 currently in progress."

Memory:
  - [Phase 4 Status](phase-4-status.md) ✅ COMPLETE (2026-05-XX)
  
Git commit:
  "docs: mark Phase 4 complete, advance to Phase 5"
```

---

**Checklist created:** 2026-05-09  
**Last used:** (Will be updated as phases complete)  
**Purpose:** Prevent status inconsistencies across docs and ensure all stakeholders see the same accurate phase progress
