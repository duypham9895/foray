# Classifier Rule Fixtures

Real-shape, anonymized email samples that act as the **regression fence** for
the regex tier table in `src/features/classifier/rules.ts`. Each fixture is a
single JSON file scanned by `tests/integration/classifier-fixtures.test.ts`,
which runs every fixture through `classifyByRules` and asserts that the
output label matches `expectedLabel`.

These fixtures verify the **rule layer ONLY** — the LLM fallback is mocked in
`src/features/classifier/service.test.ts` (Plan 03-02). Running real fixtures
through real Anthropic in CI is forbidden (cost + flakiness).

## Purpose

When the owner reports a misclassification ("foray's classifier just labeled
my recruiter outreach as a rejection"), the loop is:

1. Add the offending email (anonymized) to the appropriate `<label>/` or
   `should-not-have-fired/` subdir.
2. Run `pnpm test:run tests/integration/classifier-fixtures.test.ts` — the
   harness fails on the new fixture.
3. Tune `src/features/classifier/rules.ts` regex(es) until the test passes.
   Do **not** edit the fixture to make the test pass — the fixture is the
   truth; the rule is the derivative.
4. Commit fixture + rule change together.

This is the loop that prevents Pitfall #4 (a single wrong rejection
auto-update destroys trust in the whole product).

## Shape

Every fixture is a JSON file matching this contract:

```ts
type Fixture = {
  subject: string             // the email subject line (verbatim, anonymized)
  bodyExcerpt: string         // ≤500 chars per CLAUDE.md §6 privacy rule
  expectedLabel:              // what classifyByRules should return
    | 'rejection'
    | 'interview_invite'
    | 'recruiter_outreach'
    | 'noise'
    | 'unmatched'
  expectedConfidence?: number // optional; harness does NOT assert strictly
  source: 'real' | 'synthetic'
  notes?: string              // free-form: provenance, anonymization, why this fixture exists
}
```

The harness asserts `result.label === expectedLabel` (label match only). It
does **not** assert exact confidence — the rule's tier may legitimately
differ from the fixture's hint without changing the label.

## Anonymization rules (mandatory — CLAUDE.md §6)

Before committing a fixture sourced from a real inbox:

- **Personal names → placeholders:** "Jane Doe" / "John Smith" / "Alex Morgan".
- **Company names → placeholders:** "Acme Corp", "TechCo", "Northwind Inc".
- **Email addresses → `@example.com`.** Never commit a real recipient or
  sender address. The grep gate in `classifier-fixtures.test.ts` blocks
  `@gmail.com`, `@yahoo.com`, `@outlook.com`, `@icloud.com`.
- **Subject phrasing + body keywords:** preserve verbatim. The point of the
  fixture is the rule-tripping shape, not the identity of the sender.
- **Phone numbers, dates, calendar links:** placeholder with `example.com/...`
  if needed; otherwise drop.

If you cannot anonymize without losing the rule-relevant phrasing, mark the
fixture as `source: 'synthetic'` and rewrite the surrounding sentence to keep
the keyword while changing the structure.

## Source tag

- **`real`** — derived from an actual email the owner received, anonymized
  per the rules above. Highest fidelity; preferred when available.
- **`synthetic`** — author-written to fill a coverage gap (e.g., the owner
  hasn't received a Workday rejection yet but we want regression coverage).
  Plan 03-04 ships an entirely synthetic seed set; ongoing fixture authoring
  will mix in real anonymized samples over time.

## `should-not-have-fired/` semantics

This subdir holds emails from ATS infrastructure (Greenhouse, Lever,
Workday, etc.) that **must classify as `unmatched`** at the rule layer
alone. Examples:

- Greenhouse "we received your application" confirmation (contains
  "thank you for" — must NOT trigger the rejection 0.80 tier).
- Lever "thanks for applying" acknowledgment.
- Workday status update emails referencing "your interest".

If a future rule change loosens a regex enough to mis-fire on one of these
samples, the harness fails immediately — naming the file path. The
correct fix is to tighten the regex, not to delete the fixture.

`expectedLabel` for everything in this subdir is `'unmatched'` (rules-only;
the LLM may classify them differently downstream, but at the rule layer
they should not match).

## How to add a fixture

1. Pick the right subdir (`<label>/` for true positives, `should-not-have-fired/`
   for ATS-shaped negatives that previously fired).
2. Create a `.json` file. Filename is descriptive (e.g.,
   `greenhouse-application-received.json`, `recruiter-cold-linkedin.json`).
3. Fill in the four required fields (`subject`, `bodyExcerpt`,
   `expectedLabel`, `source`); add `expectedConfidence` and `notes` when
   helpful.
4. Run the harness:
   ```
   pnpm test:run tests/integration/classifier-fixtures.test.ts
   ```
5. If the new fixture fails, refine `src/features/classifier/rules.ts`
   (NOT the fixture) until it passes.
6. Commit fixture + rule together with a single commit message describing
   the misclassification you fixed.

## File layout

```
tests/integration/classifier-fixtures/
├── README.md                     ← this file
├── rejection/                    ← true positives for label='rejection'
├── interview_invite/             ← true positives for label='interview_invite'
├── recruiter_outreach/           ← true positives for label='recruiter_outreach'
├── noise/                        ← true positives for label='noise'
├── unmatched/                    ← genuinely-unrelated email shapes
└── should-not-have-fired/        ← ATS noise that MUST classify as unmatched
```
