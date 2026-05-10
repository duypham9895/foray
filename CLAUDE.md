# Project Rules — `foray`

These rules apply to all code changes in this repository. They override default agent behavior. AI agents (Claude Code, Cursor, etc.): re-read this at session start.

**Document map** — read all of these before writing code:

- **[PRINCIPLES.md](./PRINCIPLES.md)** — *strategic*. The principal-SWE rulebook: architecture style (Vertical Slice), TypeScript discipline, error handling philosophy, multi-tenant safety, code review checklist, refactoring discipline. **Read first.**
- **CLAUDE.md** (this file) — *tactical*. Karpathy 4 rules, testing rules, domain language, naming, commits, privacy, skills priority.
- **[AGENTS.md](./AGENTS.md)** — *contract*. Where things live, how to extend, critical commands, Prisma 7 reminders.
- **[DESIGN.md](./DESIGN.md)** — *aesthetic*. UI/UX principles ("campaign room, not robotic dashboard"), color palette, tone of voice.

---

## 1. Karpathy Coding Guidelines (mandatory)

These four rules apply to every code change. They reduce common LLM coding mistakes.

### 1.1 Think Before Coding

State assumptions explicitly. Surface ambiguities. Present 2–3 options with tradeoffs when multiple valid approaches exist. Push back on bad approaches; do not soft-sell.

When the user asks for something ambiguous, the first response is *not* code. The first response is "here's what I think you mean — confirm?" plus a quick option comparison.

### 1.2 Simplicity First

Minimum code that solves the asked problem. No speculative features, no premature abstractions, no configurability for hypothetical future requirements. If 200 lines could be 50, rewrite.

Three similar lines is better than a premature abstraction. Don't extract a helper for a single caller. Don't add a config option for a value that's only ever used once.

### 1.3 Surgical Changes

Touch only what the user asked for. Don't reformat, refactor, or "improve" adjacent code. Match existing style.

If you notice unrelated dead code or a real bug, *flag it in your response* — don't silently fix or delete. The user decides whether to scope-creep into it.

### 1.4 Goal-Driven Execution

Translate vague asks into verifiable outcomes. "Add validation" → "write tests for invalid inputs, then make them pass." "Make it faster" → "measure current latency, identify the bottleneck via profiling, fix the bottleneck, re-measure." State a mini-plan with verification checks before multi-step work.

**Tradeoff**: these guidelines bias toward caution over speed. For trivial tasks (typo fixes, single-line config tweaks), use judgment. For everything else, follow them.

---

## 2. Testing Rules (mandatory before commit)

### 2.1 Pre-commit checklist

Before every commit, all four must pass:

```bash
pnpm lint           # ESLint, no errors
pnpm typecheck      # tsc --noEmit, no errors
pnpm test:run       # vitest single-run, all green
pnpm build          # next build, no errors
```

If any fail: fix before committing. Do **not** use `--no-verify` to skip hooks. If a hook is wrong, fix the hook, not the workaround.

### 2.2 When to write tests

| Change Type | Required Tests |
|-------------|---------------|
| New utility function | Unit test in colocated `.test.ts` with edge cases |
| New component | Component test for rendering + key interaction |
| New API route | Integration test for happy path + 1–2 error cases |
| New entity in `schema.prisma` | Migration test (apply, rollback) + Prisma client test |
| Bug fix | Regression test that would have caught the bug, written **first** |
| Refactor | Run tests before AND after; never delete tests for the same behavior |
| Classifier rule change | Test against a fixture set in `tests/integration/classifier-fixtures/` |

### 2.3 Test quality standards

- Every test has a clear `describe` + `it` description explaining what it verifies
- Test edge cases: empty inputs, null/undefined, max length, special characters
- Test error paths: network failures, invalid data, permission denied (where they can happen)
- Never test implementation details — test behavior and outputs
- Mocks must be restored after each test (`vi.restoreAllMocks()` in `afterEach`)
- No hardcoded timeouts — use `vi.useFakeTimers()` when needed

### 2.4 Test file conventions

```
src/features/<slice>/service.ts        → src/features/<slice>/service.test.ts  (colocated unit)
src/core/db/tenant.ts                  → src/core/db/tenant.test.ts            (colocated unit)
src/features/<slice>/components/X.tsx  → src/features/<slice>/components/X.test.tsx (colocated component)
src/app/api/capture/route.ts           → tests/integration/capture.test.ts     (integration)
cross-slice flow                       → tests/integration/<flow>.test.ts
E2E user flow                          → tests/e2e/<flow>.spec.ts              (Playwright)
```

---

## 3. Phase Completion Protocol (mandatory)

When a phase execution is complete and verified, **immediately update these files in order** to maintain data consistency across all docs:

1. **External visibility first** (what GitHub visitors see):
   - `README.md` — Update Lean milestone status in Roadmap table
   - `docs/milestones/lean.md` — Update status line with phase info

2. **Internal tracking** (engineering tracking):
   - `.planning/STATE.md` — Update YAML header (completed_phases, completed_plans, percent), Current Position section, Performance Metrics, Open Todos, Session Continuity table
   - `.planning/ROADMAP.md` — Update Progress table with phase completion status and dates
   - `landing/index.html` — Update build status indicator in Roadmap section
   - Memory files — Update phase status file and MEMORY.md index with completion date

3. **Git commit** — Single coordinated commit referencing all updates + artifact count

See **`.planning/PHASE_COMPLETION_CHECKLIST.md`** for detailed checklist with exact file locations and format examples. This prevents the status inconsistencies that happened in early phases — all stakeholders (GitHub visitors, code reviewers, future sessions) must see the same accurate phase progress.

**Rule**: No phase is considered "complete" for communication purposes until README.md + landing page + STATE.md + memory are all updated in the same commit.

---

## 4. Domain Language

Use these terms consistently throughout the codebase, docs, UI copy, and commit messages.

| Term | Meaning |
|---|---|
| **Foray** | A single application to a single role at a single company. The unit of activity. (DB: `Application`.) |
| **Campaign** | The entire active job hunt (a collection of forays). Not a stored entity; a UI concept. |
| **Stage** | A phase within a foray (e.g., "Recruiter call", "Tech round 2"). Free-form per foray. |
| **Canonical status** | One of six fixed states for global filtering: `applied`, `screening`, `interviewing`, `offer`, `rejected`, `withdrawn`. |
| **Capture** | The act of logging a new foray (manually or via bookmarklet/extension). |
| **Ingestion** | The act of pulling Gmail and routing emails to the classifier. |
| **Classification** | Assigning an email a label: `rejection`, `interview_invite`, `recruiter_outreach`, `noise`, `unmatched`. |
| **Confidence** | Classifier's certainty (0–1). ≥0.85 → auto-update; <0.85 → review queue. |
| **Review queue** | The list of low-confidence classifications awaiting human triage. |
| **Today view** | The default landing dashboard — today's interviews, stale forays, unreviewed emails, week summary. |
| **Stale foray** | A foray with no movement (status change, email, or note) in >7 days. |

Don't invent synonyms. "Tracker" is wrong. "Application record" is wrong. The word is **foray**.

---

## 5. Naming Conventions

- **Files**: kebab-case (`gmail-poller.ts`)
- **React components**: PascalCase, one per file (`<ApplicationCard />` in `application-card.tsx`)
- **Functions**: camelCase, verb-led (`classifyEmail`, `matchApplication`)
- **Types/interfaces**: PascalCase, no prefix (`Application`, not `IApplication`)
- **DB enum values**: lowercase snake (`canonical_status`: `applied`, `screening`, etc.)
- **API routes**: noun resources (`/api/applications/[id]`); verbs only for actions (`/api/capture`)
- **Branches**: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`
- **Commits**: present-tense, verb-led, lowercase first word — `add gmail polling cron`, `fix matcher false-positive on subject reply prefix`

---

## 6. Commit Style

- One concern per commit. If you fixed two bugs, write two commits.
- Subject: ≤72 chars, present-tense verb, no trailing period.
- Body (optional, when context matters): wrap at 80 chars, explain *why*, not *what* (the diff is the what).
- Reference ADRs when commit implements a decision: `add canonical_status enum (closes ADR-0005)`.
- Never include `Co-Authored-By` for AI agents unless explicitly asked.

---

## 7. Privacy + Data Handling

- Email **bodies are not stored indefinitely**. Store metadata + body excerpt (≤500 chars). Fetch full body via Gmail API on demand for review queue display only.
- API keys (`ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, etc.) live in `.env.local` (not `.env`) and are gitignored. They never go in `.env.example`.
- The OAuth refresh token, once exchanged, is stored encrypted in DB (column `gmail_refresh_token_encrypted`). Encryption key from `ENCRYPTION_KEY` env var.
- The classifier sends email subject + body excerpt to Anthropic only when rules-first confidence is below threshold. Log prompts and responses to `data/classifier-log.jsonl` for inspection (gitignored). Never log API keys.

---

## 8. Skills + agent priority

When multiple installed AI skills could match the same trigger, prefer in this order:

1. **`grill-me` / `grill-with-docs`** (Matt Pocock) — for design and stress-testing decisions.
2. **`karpathy-guidelines`** (Karpathy) — auto-applied for any code change.
3. **Project-specific skills** (added later as needed in `.claude/skills/`).
4. **Generic skills** (superpowers, gsd-*, etc.) — only when the more specific options don't apply.

This list will grow. When you add a skill, add it here.

---

## 9. RTK (Rust Token Killer) Usage

**RTK is installed and active on this project.** Use it to optimize token consumption.

### 9.1 RTK Commands

RTK is a transparent CLI proxy that wraps commands to save **60-90% tokens** on dev operations. The hook auto-wraps most commands, but be intentional:

```bash
rtk gain              # Show token savings analytics
rtk gain --history    # Usage history + savings breakdown
rtk discover          # Analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # Run raw command (debugging, bypass hook)
```

### 9.2 When to Use RTK Explicitly

The hook auto-wraps most `git`, `pnpm`, `npm`, and CLI commands transparently. But you can call RTK explicitly for:

- **Heavy commands**: `rtk bash -c "pnpm build && pnpm test:run"` — run multiple commands through single RTK wrap
- **File exploration**: `rtk bash -c "find . -type f -name '*.tsx' | head -20"` — compress file search overhead
- **Chained operations**: Use `rtk` wrapper for any multi-step shell pipeline

### 9.3 Avoid Re-running Commands

Since RTK caches intelligently:
- Don't re-run `pnpm lint`, `git status`, `git log` repeatedly without checking local files first
- Trust RTK's compression — if it ran it once, you've saved tokens the second time
- Check `rtk gain --history` to see what's being optimized

---

## 10. Automated hooks (`.claude/hooks/`)

The project ships hooks that enforce rules in this CLAUDE.md automatically. They fire on every `Bash` / `Write` / `Edit` tool call. See `docs/harness-learnings.md` for the design rationale.

| Hook | Triggers when | Enforces |
|---|---|---|
| `block-credential-writes` | `Write`/`Edit` to `.env*`, `*.pem`, `*.key`, `~/.ssh/`, `data/classifier-log.jsonl` | §7 |
| `pre-commit-security` | `git commit ...` | §7 — scans staged files for hardcoded secrets (Anthropic, OpenAI, AWS, GCP, GitHub keys) |
| `validate-branch-name` | `git checkout -b X` / `git switch -c X` | §5 — `^(feat\|fix\|chore\|docs)/[a-z0-9._-]+$` |
| `validate-commit-msg` | `git commit -m ...` | §6 — ≤72 chars, lowercase first, no trailing period, no AI `Co-Authored-By` |
| `block-protected-push` | `git push ...` | Block direct push to `main` and any `--force` push |
| `block-dangerous-bash` | Any `Bash` | Block `sudo`, `curl \| sh`, `git reset --hard`, `git clean -f`, `rm -rf` outside allowlist, `pnpm db:reset`, `prisma migrate reset` |
| `pre-push-tests` | `git push ...` | Run `pnpm test:run` (90s timeout). Block on failure. |
| `post-write-lint` | After `Write`/`Edit` of `*.ts`, `*.tsx`, `*.js`, `*.jsx` | Run `npx eslint --max-warnings 0` on the file |

### Escape hatches (when a hook is wrong, fix the hook — don't bypass casually)

| Variable / flag | Effect |
|---|---|
| `DEVKIT_PREPUSH_SKIP=1` | Skip `pre-push-tests` for this push |
| `touch .claude/.devkit/prepush-skip` | Persistent skip of `pre-push-tests` for this project |
| `FORAY_ALLOW_DB_RESET=1` | Allow one `pnpm db:reset` / `prisma migrate reset` |
| `FORAY_ALLOW_COAUTHOR=1` | Allow `Co-Authored-By: Claude` in commit (use only when user explicitly asks) |
| `DEVKIT_STATUSLINE_ANIMATE=0` | Disable statusline animation |

### Diagnostics

```bash
.claude/bin/devkit-doctor.sh        # full health check + last 20 hook decisions
tail .claude/.devkit/hook-log.jsonl  # raw audit trail (capped at 500 entries)
```

The statusline shows live `[project] branch · model · ctx % · sess % · week %` — fall-back budgets configurable in `.claude/devkit-plan.json`.

---

## 11. When in doubt

- Read [PRINCIPLES.md](./PRINCIPLES.md) for "how should this be shaped" (architecture, error handling, security)
- Read [AGENTS.md](./AGENTS.md) for "where things live"
- Read the relevant ADR for "why we chose this"
- Read [docs/data-model.md](./docs/data-model.md) for "how the schema works"
- Run the **Code Review Checklist** in PRINCIPLES.md §"Code review checklist" before declaring a change complete
- Ask the user. Wrong code is more expensive than a clarifying question.
