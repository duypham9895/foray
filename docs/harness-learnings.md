# Harness learnings from `ringkas-devkit` (beli)

Source: `~/Documents/Workspace/Ringkas/Programming/Gitlab/v2/beli`
Audited: 2026-05-10
Audience: foray maintainer (Duy)

## What beli is

A Claude Code plugin harness for Ringkas engineers. Three layers:

1. **Hooks** (12 shell scripts) — enforce conventions automatically
2. **Sub-agents** (5 markdown specs) — planner, coder, tester, reviewer, security
3. **Skills** (~15) — orchestrate hooks + agents into named workflows (`/feature`, `/bugfix`, `/review`, `/audit`)

Plus: `bin/devkit-statusline.sh` (token usage display), `bin/devkit-doctor.sh` (health check), `.devkit/` artifact directory for cross-skill handoff.

## Gap analysis vs. foray today

`foray/.claude/` currently has only `worktrees/` and an RTK permission allowlist. The CLAUDE.md prescribes strict rules (lint/typecheck/test/build before commit, branch naming, commit format, secret handling, privacy) — but **nothing enforces them**. A misbehaving agent can silently violate every rule.

Beli already overlaps heavily with `foray`'s installed GSD skill suite (planning, execution, code review, audit). So importing beli wholesale would be redundant. The **non-overlapping value** is the hook layer.

## Patterns worth porting (ranked)

### Tier 1 — direct CLAUDE.md enforcement (high value, low effort)

| Beli hook | What it enforces in foray | foray CLAUDE.md ref |
|---|---|---|
| `block-credential-writes.sh` | Block `Write`/`Edit` of `.env*`, `.pem`, `.key`, `~/.ssh/`, `~/.aws/` (allow `.env.example`) | §7 Privacy + Data Handling |
| `pre-commit-security.sh` | Scan for hardcoded secrets in `git commit` payloads | §7 |
| `validate-branch-name.sh` | Regex `^(feat\|fix\|chore\|docs)/.+` on `git checkout -b` / `switch -c` | §5 Naming Conventions |
| `validate-commit-msg.sh` | Regex on `git commit -m` — present-tense, lowercase, ≤72 chars | §6 Commit Style |
| `block-protected-push.sh` | Block `git push origin main` and any `--force` push | §6 (implicit) |
| `block-dangerous-bash.sh` | Block `rm -rf` outside allowlist, `git reset --hard`, `git clean -fd`, `curl \| sh` | not currently in CLAUDE.md, but obviously desirable |
| `post-write-lint.sh` | Run `pnpm lint` on the just-edited file (after `Write`/`Edit`) | §2.1 Pre-commit checklist |
| `pre-push-tests.sh` | Run `pnpm test:run` before `git push`, with `DEVKIT_PREPUSH_SKIP=1` escape hatch | §2.1 |

These convert ~8 manually-followed rules into hard gates. Lowest-effort wins for the existing CLAUDE.md.

### Tier 2 — observability (medium value, medium effort)

| Pattern | Value for foray |
|---|---|
| `devkit-statusline.sh` | Live `ctx N% │ sess N% │ week N%` in every prompt — useful for the 1M-context Opus sessions you're using |
| `bin/devkit-doctor.sh` | One-shot health check: hooks executable, statusline configured, last 20 hook decisions |
| `.claude/.devkit/hook-log.jsonl` (capped at 500 entries) | Audit trail of what every hook decided. Helps debug "why did Claude skip X?" |

### Tier 3 — skill / agent patterns (low value — GSD already covers most)

- `## STAGE COMPLETE` sentinel pattern for orchestrator → sub-agent handoff. Useful if you write a custom skill that chains multiple agents without GSD.
- `.devkit/` artifact passing between skills — same idea as `.planning/` but lighter / per-task. **Skip**: GSD already has this.
- `disable-model-invocation: true` in skill frontmatter — prevents the model from auto-firing the skill from a similar-sounding prompt. Worth knowing if you write your own skills.

### Tier 4 — explicitly **not** worth porting

- `/feature`, `/bugfix`, `/review`, `/audit` workflows — GSD's `/gsd-execute-phase`, `/gsd-debug`, `/gsd-code-review`, `/gsd-secure-phase` already cover these.
- `planner.md`, `coder.md`, `tester.md`, `reviewer.md`, `security.md` agents — GSD ships richer equivalents.
- `/git-workflow`, `/grill-me`, `/zoom-out`, `/to-issues` — overlap with GSD skills + the brainstorming skill from superpowers.
- ISO 27001 audit content — Ringkas-specific, not foray's regulatory context.
- Notion/Testmo/GitLab MCP setup — foray uses GitHub, not GitLab, and Linear isn't in scope.

## Recommended scope (3 options)

### Option A — minimal: lint + secret protection (~30 min, 4 hooks)

Port only the hooks that protect against destructive or privacy-violating actions:
- `block-credential-writes.sh`
- `pre-commit-security.sh`
- `block-protected-push.sh` (block push to `main`)
- `post-write-lint.sh` (auto-`pnpm lint` after edits)

Lowest disruption. No format gates, no test gates. Catches the worst classes of agent misbehavior.

### Option B — full enforcement: all Tier 1 hooks (~1.5 hr, 8 hooks)

Everything in Tier 1. Branch names, commit messages, lint, tests, secrets, dangerous bash, all enforced. Highest leverage on what CLAUDE.md already says.

Risk: more friction. If you discover a hook is wrong, you have to fix it before continuing the session. Provide an escape-hatch env var per beli's example (`DEVKIT_PREPUSH_SKIP=1`).

### Option C — full enforcement + statusline + doctor (~2.5 hr)

Tier 1 + Tier 2. Adds ctx/sess/week display in the statusline and a one-shot health check.

The statusline helps you spot when you're burning the 1M context window mid-session — directly useful for the Opus 4.7 1M sessions you've been running.

## Implementation sketch (if Option B or C is chosen)

Don't copy beli's plugin format — you don't need cross-repo distribution. Inline into `foray/.claude/`:

```
foray/.claude/
├── hooks/
│   ├── _lib.sh                       # logging helper
│   ├── block-credential-writes.sh
│   ├── block-protected-push.sh
│   ├── block-dangerous-bash.sh
│   ├── pre-commit-security.sh
│   ├── validate-branch-name.sh
│   ├── validate-commit-msg.sh
│   ├── post-write-lint.sh            # runs `pnpm lint` on changed file
│   └── pre-push-tests.sh             # runs `pnpm test:run`
└── settings.json                      # registers hooks (PreToolUse / PostToolUse / Stop)
```

Beli's regexes need foray-specific tweaks:
- Branch types: keep `feat|fix|chore|docs` (foray's CLAUDE.md §5), drop Ringkas-specific ones (`cr`, `bugfix`, `devops`, `release`).
- Commit format: foray's CLAUDE.md §6 says **no** ticket prefix (no `[EP-754]`), unlike beli. Drop bracketed-ticket part of regex.
- Lint command: `pnpm lint` (one file at a time isn't supported — beli uses `npx eslint <file>`; do the same).

## What I'd do if it were my call

**Option B**, with one carve-out: skip `pre-push-tests.sh` initially. The full test suite is slow enough that auto-running it on every push will become friction; you'll start setting `DEVKIT_PREPUSH_SKIP=1` permanently. Better to add it later once you've felt the pain of forgetting `pnpm test:run` once or twice.

That gets you 7 hooks covering: credentials, secrets, branch names, commit messages, protected pushes, dangerous bash, post-write lint. ~1 hour of work, fully reversible (`rm -rf .claude/hooks`).
