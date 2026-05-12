# Codex Workflow

This file turns the old Claude/GSD session habits into a practical Codex workflow. `AGENTS.md` remains the contract; this page is the day-to-day checklist.

## Start Of Task

1. Check the worktree:

   ```bash
   git status --short --branch --untracked-files=all
   ```

2. Read the smallest useful context:
   - `AGENTS.md`
   - `PRINCIPLES.md`
   - the files directly involved in the task
   - relevant ADRs in `docs/decisions/`
   - `.planning/ROADMAP.md` for phase work

3. If the task touches Next.js App Router APIs, read the local Next 16 docs under `node_modules/next/dist/docs/` before editing.

## Editing Rules

- Keep changes focused. Avoid opportunistic refactors.
- Preserve unrelated user or prior-agent changes.
- Use existing vertical-slice patterns before adding abstractions.
- Do not add dependencies unless the existing stack cannot solve the problem cleanly.
- Do not edit generated Prisma files by hand.
- Do not edit committed migrations; create a new migration for schema changes.
- Do not print secrets from `.env`, `.env.local`, OAuth payloads, tokens, or classifier logs.

## Verification

For docs-only changes, a diff review is usually enough:

```bash
git diff -- AGENTS.md README.md SETUP.md docs
```

For TypeScript or app behavior changes, run the narrowest relevant test first, then the full gate when feasible:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Integration tests require Docker/Testcontainers:

```bash
DOCKER_HOST=unix://$HOME/.docker/run/docker.sock pnpm test:run
```

Use the `DOCKER_HOST` form on Docker Desktop if plain `pnpm test:run` cannot find the Docker socket.

## Git Hygiene

- Stage only files related to the task.
- Do not include unrelated WIP in commits.
- Use present-tense, verb-led commit messages, for example:

  ```bash
  git commit -m "document codex workflow"
  git commit -m "migrate middleware to proxy"
  ```

- If a branch already contains unrelated WIP, either leave it unstaged or make a narrow commit containing only the files you changed.

## User Working Style

- Prefer end-to-end execution when access is already available. The user expects Codex to SSH, inspect logs/data, deploy, and verify rather than stopping at instructions.
- Explain root cause after fixing user-facing issues. The user often asks "why?" when a workflow still feels broken.
- Ask only when blocked or when a destructive/high-risk choice cannot be inferred safely.
- For repeated Hostinger work, use `docs/operations.md` before asking for connection details.

## Phase Work

When continuing roadmap phases:

- Treat `.planning/ROADMAP.md` as the live plan.
- Treat `.planning/STATE.md` as resumable context, but verify it against the roadmap and code because it can drift.
- Record completed phase work in the relevant `.planning/phases/<phase>/` summary or verification file when the task is explicitly phase-tracking work.
- Keep public docs (`README.md`, `docs/milestones/*.md`, `docs/data-model.md`, `docs/architecture.md`) in sync when behavior or schema changes.
