# Phase 3: Classifier + Matcher - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** Auto-generated (`--auto` — Claude picked recommended defaults; user can override during plan-phase)

<domain>
## Phase Boundary

Two pure-ish slices that turn an email into a labeled, matched, cost-bounded decision — without ever touching Gmail or writing to an `Application`. Designed in one pass so the **trust-trio** (per-label thresholds + budget guard + ATS-domain skip) is coherent before Phase 4 wires it into the live pipeline.

**Slice 1 — `classifier`:** classifies subject + body excerpt → label + confidence + classifiedBy.
**Slice 2 — `matcher`:** maps `{userId, gmailThreadId, fromDomain}` → `applicationId | null` via 4-step tiebreak.

**Requirements covered:** CLASS-01, CLASS-02, CLASS-03, CLASS-04, MATCH-01, MATCH-02, MATCH-03

**Out of scope:**
- Gmail OAuth, ingestion, polling (Phase 4).
- Pipeline orchestration (`ingest → match → classify → act`) — Phase 4.
- Status-regression block CONSUMER side — Phase 4 (the BLOCK itself was written in Phase 2's `applications/service.ts`; Phase 3 just outputs labels Phase 4 will route).
- `/inbox` review queue UI — Phase 5.
- Auto-update Event writing — Phase 4 (Phase 3 returns labels; the act-stage in Phase 4 writes the Event).

**Hard contract for Phase 4:**
- `classifier/service.classifyEmail({subject, bodyExcerpt}) => Promise<Result<{label, confidence, classifiedBy: 'rules' | 'llm'}, AppError>>`
- `matcher/service.matchEmail({userId, gmailThreadId, fromDomain}) => Promise<Result<{applicationId: ApplicationId | null}, AppError>>`
- `classifier/thresholds.ts` exports per-label `Record<EmailClassification, number>` with asymmetric values (rejection HIGHER than interview_invite per Pitfalls #4)
- `classifier/budget.ts` exports `checkBudget()` returning `Result<void, RateLimited>` based on today's `data/classifier-log.jsonl` cost sum (≥ $0.50/day blocks LLM call)

</domain>

<decisions>
## Implementation Decisions

### Area 1: Classifier rule organization (CLASS-01)

- [auto] **File layout:** `src/features/classifier/rules.ts` exports `Record<EmailClassification, RegExp[]>`. One regex const per label. Keep regexes simple and externalized so tests can import and assert against them directly.
- [auto] **Match strategy:** For each label, scan subject FIRST then body. First match wins. If multiple labels match, return highest-priority match in this order: `rejection > interview_invite > recruiter_outreach > noise > unmatched`. Document the priority in a comment + test the tiebreak.
- [auto] **Confidence assignment for rules:** Rule match = `confidence: 0.95` for explicit phrases ("we have decided not to move forward"), `confidence: 0.80` for generic phrases ("thank you for your interest"). Encode the tier in `rules.ts` as `{ pattern: RegExp, confidence: 0.95 | 0.80, label: EmailClassification }[]`. NOT a flat array of regexes — paired with confidence values.
- [auto] **Unmatched semantics:** No rule matched → return `{ label: 'unmatched', confidence: 0, classifiedBy: 'rules' }` and DO NOT call LLM (LLM is only called when rules match weakly, e.g., `confidence < 0.85`). This keeps cost bounded.

### Area 2: LLM fallback (CLASS-02)

- [auto] **Trigger condition:** Rules-first runs. If rules return `confidence < 0.85` AND label != 'unmatched', call LLM to refine. If `confidence ≥ 0.85`, accept the rule decision and skip LLM. If `unmatched`, return as-is — do NOT escalate to LLM (controls cost; better to have a clear "not classified" outcome than wild LLM guesses on noise).
- [auto] **Model + config:** Claude Haiku (`claude-haiku-4-5-20251001`) via `@anthropic-ai/sdk` 0.95.x. `timeout: 15_000`, `maxRetries: 0` (per-tick budget guard handles retry; SDK retries would compound cost). Use **structured tool output** — define a `classify_email` tool with JSON schema `{ label: enum, confidence: number, reasoning: string }` so the model returns parseable structured data, not free text.
- [auto] **Wrap in `Result`:** SDK call wrapped in try/catch → `Result<{ label, confidence, classifiedBy: 'llm' }, AppError>`. Errors mapped: 429 → `RateLimited`, 401 → `Unauthorized`, 5xx → `External`, network/timeout → `External`.
- [auto] **Prompt:** System prompt names the 5 labels and gives one explicit example per label. User message is `Subject: …\n\nBody (excerpt, ≤500 chars): …`. NO body bodies stored or sent beyond the 500-char excerpt (privacy per CLAUDE.md §6).

### Area 3: Per-label thresholds (CLASS-03)

- [auto] **Storage:** Typed const `THRESHOLDS: Record<EmailClassification, number>` in `src/features/classifier/thresholds.ts`. Recommended defaults:
  - `rejection: 0.92` — HIGH bar (Pitfall #4: wrong rejection auto-update destroys trust catastrophically)
  - `interview_invite: 0.85` — moderate (false positives are recoverable, false negatives just go to review queue)
  - `recruiter_outreach: 0.80` — moderate-low (low stakes — these don't change Application status)
  - `noise: 0.70` — aggressive (we WANT noise filtered, false-positive on noise just means it sits in review queue harmlessly)
  - `unmatched: 1.0` — never auto-acts (always sent to review)
- [auto] **NOT a single env var:** A flat `CLASSIFIER_AUTO_THRESHOLD=0.85` blanket gate is rejected (Pitfall #4). Test must verify thresholds are enforced PER LABEL, not globally.
- [auto] **Threshold consumer:** Phase 4's act-stage will read these thresholds; Phase 3 just exports them. ADR-0012 (already written for Phase 2's regression block) is amended to include this asymmetric-threshold rationale.

### Area 4: Budget guard + idempotency + batch cap (CLASS-04)

- [auto] **Budget guard location:** `src/features/classifier/budget.ts`. Single function `checkBudget(): Promise<Result<void, RateLimited>>` reads `data/classifier-log.jsonl` (gitignored), sums today's `cost_usd` entries, returns `err({_tag: 'RateLimited', retryAfterMs: msUntilTomorrow()})` if ≥ `$0.50`. Otherwise `ok()`. Called BEFORE the SDK call inside `classifyEmail`.
- [auto] **Cost calculation:** Each LLM call after success appends one JSONL row: `{timestamp, inputTokens, outputTokens, costUsd, model}`. Use Anthropic's published Haiku pricing (`$0.80/MTok input`, `$4.00/MTok output` as of 2026-01) — encode as constants in `budget.ts`, comment with the pricing source/date so future updates are easy.
- [auto] **Idempotency:** `classifyEmail` is a PURE function over `{subject, bodyExcerpt}` — it doesn't read or write the database. Idempotency on `email.classifiedBy` is enforced by Phase 4's pipeline orchestrator BEFORE calling classifier (skip if `email.classifiedBy != null`). Phase 3 just provides the function; Phase 4 ensures it isn't called twice for the same email.
- [auto] **Per-batch hard cap:** Phase 3 doesn't loop — it classifies one email per call. The 50-email-per-tick cap is Phase 4's loop concern. Phase 3 documents this in the function-level JSDoc but doesn't enforce it.

### Area 5: Matcher tiebreak + ATS skip (MATCH-01..03)

- [auto] **Tiebreak order (deterministic, single function):**
  1. **Thread continuity:** `tenantDb(userId).email.findFirst({where: { gmailThreadId, applicationId: { not: null } }})` — if found, return its `applicationId`.
  2. **Sender-domain match:** Lookup `tenantDb(userId).company.findFirst({where: { domain: fromDomain }})` — if found, return its first owned `Application.id` (most recent by `appliedAt`).
  3. **ATS-domain skip:** BEFORE step 2, check `isAtsDomain(fromDomain)` — if true, skip step 2 entirely and proceed to step 4. Pitfall #5: Greenhouse/Lever emails will domain-match recruiters across ALL the user's applications.
  4. **Unmatched:** Return `{ applicationId: null }`.
- [auto] **Domain extraction:** `fromDomain` is provided by the caller (Phase 4 extracts from `from` header). Matcher just trusts the input. Document this contract.
- [auto] **Result type:** `Promise<Result<{ applicationId: ApplicationId | null }, AppError>>`. The `null` case is `ok({ applicationId: null })`, not `err(...)`. "Unmatched" is a normal outcome, not an error.
- [auto] **No direct prisma:** All DB access via `tenantDb(userId)`. Verified by ESLint `no-direct-prisma` + tested.

### Area 6: Test fixtures + ADR-0012 amendment

- [auto] **Fixtures location:** `tests/integration/classifier-fixtures/` with subdirs per label: `rejection/`, `interview_invite/`, `recruiter_outreach/`, `noise/`, `unmatched/`, `should-not-have-fired/`. Each fixture is a JSON file: `{ subject, bodyExcerpt, expectedLabel, expectedConfidence?, source: 'real' | 'synthetic', notes? }`. Real samples sourced from the owner's own inbox (anonymized) where possible; synthetic where not. ≥1 real per label + ≥1 real Greenhouse/Lever/Workday in `should-not-have-fired/`.
- [auto] **Matcher fixtures:** `tests/integration/matcher-fixtures.ts` exports test cases covering all 4 tiebreak paths: thread-found, domain-found, ATS-blocked-then-unmatched, plain-unmatched. Use `tenantDb` with seeded test users.
- [auto] **ADR amendment:** ADR-0012 (already written in Phase 2 for status-regression block + auto-update visual) gets a new section "Asymmetric per-label thresholds" documenting the 0.92/0.85/0.80/0.70 defaults and the rationale (Pitfall #4). No new ADR — same decision document.

### Claude's Discretion

- Exact rule regex patterns — write a strong starting set; can refine when fixtures fail.
- LLM prompt wording — pick a clear concise prompt; iterate when fixtures show it's confusing labels.
- Retry semantics on Anthropic 529 (overloaded) — recommend: NO retry inside classifier (per `maxRetries: 0`). Phase 4's queue handles retry by deferring re-classification to the next tick.
- Whether `classifier/service.ts` exports a single `classifyEmail` or separates `classifyByRules` + `classifyByLlm` for testability — recommend internal separation, single public export.
- JSONL log file rotation — none for Lean (single user, single file). Standard milestone might add daily rotation.
- Whether matcher's "domain match" returns the most-recent application or ALL — recommend most-recent (single match), document the limitation; review queue surfaces the choice if ambiguous.
- Threading semantics: if multiple emails on the same thread are linked to DIFFERENT applications (shouldn't happen, but…) — return the most recent.

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets (Phase 1 + Phase 2 deliverables)

- `src/core/auth/session.ts` → `requireUser()` — Phase 4 will gate calls; Phase 3 services accept `userId` directly (no session call inside the service).
- `src/core/db/with-rls.ts` + `src/core/db/tenant.ts` → `withRls(userId, async tx => …)` and `tenantDb(userId)`. Matcher uses `tenantDb` for both lookups (read-only).
- `src/core/types/ids.ts` → `UserId`, `ApplicationId` branded types. Phase 3 uses both.
- `src/core/errors/index.ts` → `errors.*()` factory + `Result` re-export. New error variants needed: `errors.rateLimited({retryAfterMs})`, `errors.external(cause)`, `errors.budgetExceeded()` (or reuse `rateLimited`).
- `src/core/env.ts` → Zod-validated env. Add `ANTHROPIC_API_KEY` if not already present.
- `src/core/domains/ats-domains.ts` → `isAtsDomain(domain)` from Phase 2. Matcher's step 3 imports this directly. **Cross-slice import: classifier/matcher → core, OK; not slice-to-slice.**
- `prisma/schema.prisma` enums: `EmailClassification`, `ClassifiedBy`, `EventType` — already exist.
- `@anthropic-ai/sdk` 0.95.1 — installed in Phase 0 scaffold. SDK's tool-use surface is the right shape for structured output.

### Established patterns (don't reinvent)

- All fallible operations: `Result<T, AppError>` (neverthrow). `eslint-plugin-neverthrow` enforces.
- All Prisma access: `tenantDb` or `withRls`. Direct `prisma.*` blocked by `no-direct-prisma`.
- Module boundaries: `classifier/` and `matcher/` may import from `core/` and `ui/`, NOT from each other or `applications/`. Phase 3 keeps them as PEER slices — neither calls the other.
- Test categories per CLAUDE.md §2.2: classifier needs unit (rules + thresholds + budget) + integration (fixtures harness with real LLM disabled in CI). Matcher needs integration tests (real DB via Testcontainers).
- Logger: `pino` with redaction — log classifier inputs/outputs at debug level, NEVER at info (PII concern). Cost log is the structured artifact (`data/classifier-log.jsonl`).

### Integration points (Phase 3 will create)

- `src/features/classifier/{rules,thresholds,budget,service,schema}.ts` + `tests/`
- `src/features/matcher/{service,schema}.ts` + `tests/`
- `tests/integration/classifier-fixtures/<label>/<sample>.json` (≥5 real samples seed set)
- `tests/integration/classifier-service.test.ts` (rules + threshold tests; LLM mocked or skipped in CI)
- `tests/integration/matcher-service.test.ts` (4 tiebreak paths + ATS skip + RLS isolation)
- `data/classifier-log.jsonl` — gitignored; created on first LLM call by `budget.ts`.
- ADR-0012 amended (or split into ADR-0013 if cleaner — let planner decide).
- `package.json` — no new dependencies expected (Anthropic SDK already installed).

### Phase 4 dependency surface (just enough so Phase 4 can be planned without re-reading this)

```ts
// Phase 4 will import:
import { classifyEmail } from '@/features/classifier/service'
import { THRESHOLDS } from '@/features/classifier/thresholds'
import { matchEmail } from '@/features/matcher/service'

// And use:
const cls = await classifyEmail({ subject, bodyExcerpt })
if (cls.isOk() && cls.value.confidence >= THRESHOLDS[cls.value.label]) {
  const match = await matchEmail({ userId, gmailThreadId, fromDomain })
  if (match.isOk() && match.value.applicationId !== null) {
    // act stage: applyAutoStatusChange(...) using Phase 2's service
  }
}
```

</code_context>

<specifics>
## Specific Ideas

- **Rules-first regex tier examples (starting points; refine with fixtures):**
  - `rejection` (0.95): `/we (have decided|regret to inform).{0,40}(not move forward|not be moving forward|other (candidates|applicants))/i`
  - `rejection` (0.80): `/(thank you for your interest|after careful consideration)/i`
  - `interview_invite` (0.95): `/(would (you )?like to (set up|schedule)|propose times for|next step.{0,30}(call|interview))/i`
  - `recruiter_outreach` (0.95): `/(saw your (profile|background)|came across your (resume|profile)|reach out about a role)/i`
  - `noise` (0.95): `/(unsubscribe|view in browser|update your preferences)/i` AND no other label matched
- **LLM tool definition (Anthropic structured output):**
  ```ts
  const classifyTool = {
    name: 'classify_email',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string', enum: ['rejection', 'interview_invite', 'recruiter_outreach', 'noise', 'unmatched'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string', maxLength: 200 }
      },
      required: ['label', 'confidence', 'reasoning']
    }
  }
  ```
- **Cost log entry:** `{"ts":"2026-05-09T12:34:56.789Z","model":"claude-haiku-4-5","inputTokens":420,"outputTokens":42,"costUsd":0.000504,"emailHash":"sha256:..."}` — emailHash is a privacy-preserving identifier (sha256 of normalized subject+excerpt) so we can detect "this email was classified twice" without storing PII.
- **Matcher pseudo-code:**
  ```ts
  export async function matchEmail({ userId, gmailThreadId, fromDomain }: MatchEmailInput): Promise<Result<{ applicationId: ApplicationId | null }, AppError>> {
    const tdb = tenantDb(userId)
    // 1. thread continuity
    const threadEmail = await tdb.email.findFirst({ where: { gmailThreadId, applicationId: { not: null } }, orderBy: { receivedAt: 'desc' } })
    if (threadEmail?.applicationId) return ok({ applicationId: ApplicationId(threadEmail.applicationId) })
    // 2. ATS skip BEFORE domain match
    if (isAtsDomain(fromDomain)) return ok({ applicationId: null })
    // 3. domain match
    const company = await tdb.company.findFirst({ where: { domain: fromDomain }, include: { applications: { orderBy: { appliedAt: 'desc' }, take: 1 } } })
    if (company?.applications[0]) return ok({ applicationId: ApplicationId(company.applications[0].id) })
    // 4. unmatched
    return ok({ applicationId: null })
  }
  ```
- **Fixture seeding plan:** Owner provides 5 sanitized real emails (one per label) — anonymize sender names/email addresses but keep verbatim subject + body excerpts. Synthetic fixtures fill in if real samples aren't available; commit synthetic ones alongside `source: 'synthetic'` flag.

</specifics>

<deferred>
## Deferred Ideas

- LLM fine-tuning / few-shot example library (Standard milestone — Lean uses zero-shot with one example per label in system prompt).
- Confidence calibration (e.g., Platt scaling) — Standard.
- Per-user threshold override UI — Full milestone.
- Multilingual classification — out of scope (English only for Lean).
- Cost log rotation / archival — Standard.
- Classifier learning from review-queue corrections — Full milestone (would close the loop: user fixes a misclassification → fixture added automatically).
- Batch parallelism in Phase 4's pipeline (multiple emails through classifier in parallel) — Phase 4 might do this, not Phase 3.
- Matcher fuzzy domain match (e.g., subdomain handling beyond apex) — Lean uses exact apex match only.

</deferred>
