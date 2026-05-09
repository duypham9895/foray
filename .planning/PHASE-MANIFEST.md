# Phase Manifest — Global Numbering Map

**Version**: 1.0  
**Last Updated**: 2026-05-10
**Purpose**: Single source of truth for global phase numbering across all milestones (Lean → Standard → Full)

---

## Phase Numbering Overview

| Phase # | Milestone | Pos in MS | Phase Name | Status |
|---------|-----------|-----------|-----------|--------|
| 1–5 | **Lean** | 1–5 | Foundation → Review Queue | ✅ Complete (shipped 2026-05-09) |
| 6–10 | **Standard** | 1–5 | Bookmarklet → E2E Tests | ⏳ Pending |
| 11–16 | **Full** | 1–6 | Chrome Extension → Polish | ⏳ Pending |
| 17+ | **Future** | 1+ | Multi-LLM Providers → ... | 🔮 Future |

---

## Detailed Phase Mapping

### Lean Milestone (v0.1) — Phases 1–5

| Phase | Name | Location | Status |
|-------|------|----------|--------|
| **1** | Foundation + Auth | `.planning/phases/01-foundation-auth` | ✅ Complete |
| **2** | Applications Slice (Manual Tracker) | `.planning/phases/02-applications-slice-manual-tracker` | ✅ Complete |
| **3** | Classifier + Matcher | `.planning/phases/03-classifier-matcher` | ✅ Complete |
| **4** | Gmail Ingestion + Pipeline | `.planning/phases/04-gmail-ingestion-pipeline-cron` | ✅ Complete |
| **5** | Review Queue + Acceptance | `.planning/phases/05-review-queue-acceptance` | ✅ Complete |

### Standard Milestone (v0.2) — Phases 6–10

| Phase | Name | Location | Status |
|-------|------|----------|--------|
| **6** | Bookmarklet + Capture API (Standard-1) | `.planning/phases/06-bookmarklet-capture-api` | ⏳ Pending |
| **7** | Today Dashboard (Standard-2) | `.planning/phases/07-today-dashboard` | ⏳ Pending |
| **8** | Tags + Search (Standard-3) | `.planning/phases/08-tags-search` | ⏳ Pending |
| **9** | UX Polish + Keyboard Shortcuts (Standard-4) | `.planning/phases/09-ux-polish-shortcuts` | ⏳ Pending |
| **10** | E2E Tests + Acceptance (Standard-5) | `.planning/phases/10-e2e-acceptance` | ⏳ Pending |

### Full Milestone (v0.3) — Phases 11–16

| Phase | Name | Location | Status |
|-------|------|----------|--------|
| **11** | Chrome MV3 Extension (Full-1) | `.planning/phases/11-chrome-mv3-extension` | ⏳ Pending |
| **12** | Document Storage (Full-2) | `.planning/phases/12-document-storage` | ⏳ Pending |
| **13** | Recruiter Entity (Full-3) | `.planning/phases/13-recruiter-entity` | ⏳ Pending |
| **14** | Google Calendar Integration (Full-4) | `.planning/phases/14-calendar-integration` | ⏳ Pending |
| **15** | Analytics Dashboard (Full-5) | `.planning/phases/15-analytics-dashboard` | ⏳ Pending |
| **16** | Reminders + Polish (Full-6) | `.planning/phases/16-reminders-polish` | ⏳ Pending |

### Future Milestone (v0.4+) — Phases 17+

| Phase | Name | Location | Status |
|-------|------|----------|--------|
| **17** | Multi-LLM Provider Abstraction (Future-1) | `.planning/phases/17-multi-llm-provider-abstraction` | 🔮 Future |

---

## Directory Structure

All phase directories follow this pattern:

```
.planning/phases/
├── NN-phase-name/                    (NN = global phase number)
│   ├── NN-01-PLAN.md                 (Plan 1 of 3 or 4)
│   ├── NN-02-PLAN.md
│   ├── NN-03-PLAN.md
│   ├── NN-04-PLAN.md                 (if 4-plan phase)
│   ├── RESEARCH.md                   (Technical context + constraints)
│   ├── REQUIREMENTS.md               (Functional + non-functional specs)
│   └── ACCEPTANCE.md                 (Acceptance criteria checklist)
```

---

## Milestone Transitions

### Lean → Standard (Automatic)
- **Trigger**: Phase 5 automation completes
- **Verification**: Pre-commit gate (lint, typecheck, test, build, depcheck)
- **First Phase**: Phase 6 (Bookmarklet + Capture API)
- **File**: `.planning/AUTOMATION-BRIDGE-CONFIG.md`

### Standard → Full (Automatic)
- **Trigger**: Phase 10 automation completes
- **Verification**: Pre-commit gate + E2E tests passing
- **First Phase**: Phase 11 (Chrome MV3 Extension)
- **File**: `.planning/CONTINUOUS-EXECUTION-MANIFEST.md`

---

## How to Use This Manifest

1. **Automation system**: Read this file at transition points to know what phase comes next
2. **Documentation**: Reference phase numbers in plan files, research, and requirements
3. **Git commits**: Use phase numbers in commit messages: `feat(phase-6): add bookmarklet source`
4. **Status updates**: Update the **Status** column as phases complete
5. **Troubleshooting**: If uncertain which phase you're in, consult this table

---

## File Conventions in Each Phase

Every phase directory contains:

- **NN-01-PLAN.md, NN-02-PLAN.md, NN-03-PLAN.md** (sometimes NN-04-PLAN.md)  
  → Executable task lists with 4–5 tasks each
  → Header: `# Phase NN: [Name] — Plan 1/3`

- **RESEARCH.md**  
  → Technical deep-dive: constraints, rationale, patterns, architecture decisions
  → Header: `# Research: Phase NN — [Name]`

- **REQUIREMENTS.md**  
  → Functional requirements table, NFRs, boundary conditions, success criteria
  → Header: `# Requirements: Phase NN — [Name]`

- **ACCEPTANCE.md** (optional, for complex phases)  
  → Acceptance criteria checklist, UAT checklists

---

## Notes for System Automation

When the automation system reads phases for execution:

1. **Check STATE.md** for current phase number
2. **Look up that number in this manifest** to find the directory
3. **Read `.planning/phases/NN-*/NN-0N-PLAN.md`** files to execute tasks
4. **On completion**, increment phase and transition to next

**Example flow:**
```
STATE.md says: current_phase = 6
Manifest says: Phase 6 = 06-bookmarklet-capture-api
System reads: .planning/phases/06-bookmarklet-capture-api/06-01-PLAN.md
System executes all tasks in that plan...
On completion: current_phase = 7
```

---

*Manifest auto-maintained. Update this file whenever phase structure changes.*
