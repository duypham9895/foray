---
phase: 11-reminders-cron-infrastructure
reviewed: 2026-05-10T12:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - messages/en.json
  - messages/id.json
  - messages/vi.json
  - src/app/today/page.tsx
  - src/components/app-shell.tsx
  - src/components/nav-links-wrapper.tsx
  - src/components/nav-links.tsx
  - src/core/cron/registry.test.ts
  - src/core/cron/registry.ts
  - src/features/applications/actions.ts
  - src/features/applications/components/application-detail.tsx
  - src/features/applications/components/follow-up-editor.test.tsx
  - src/features/applications/components/follow-up-editor.tsx
  - src/features/applications/follow-up-service.test.ts
  - src/features/applications/follow-up-service.ts
  - src/features/applications/schema.ts
  - src/features/today/components/follow-ups-card.tsx
  - src/features/today/queries.test.ts
  - src/features/today/queries.ts
  - src/instrumentation.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 11 adds follow-up/reminder functionality to the foray application: a `followUpAt` field on applications, set/clear server actions, a FollowUpEditor component, an overdue follow-ups query, a FollowUpsCard for the Today dashboard, and a multi-job cron registry with advisory lock support. The implementation follows the project's established patterns well -- Result types, RLS-scoped queries, Zod validation, and colocated tests are all present and correct.

The main gap is i18n: the new FollowUpEditor component and parts of ApplicationDetail have hardcoded English strings that bypass the `next-intl` system, meaning non-English users will see English text in the follow-up UI. Three warnings address this. The info items note minor code quality observations that do not affect correctness.

## Warnings

### WR-01: FollowUpEditor has 10+ hardcoded English strings bypassing i18n

**File:** `src/features/applications/components/follow-up-editor.tsx:66,71,101,106,113,189,205,210`
**Issue:** The entire FollowUpEditor component uses hardcoded English strings instead of the `next-intl` translation system. No corresponding keys exist in `messages/en.json`, `messages/id.json`, or `messages/vi.json`. Non-English users will see English text for all follow-up UI. Affected strings:
- "No follow-up set" (line 66)
- "Set follow-up" (line 71)
- "Follow-up: {date}" (line 101)
- "Edit" (line 106)
- "Clear" / "Clear follow-up date" (lines 113-114)
- "Pick a date" (line 189)
- "Saving..." / "Save" (line 205)
- "Cancel" (line 210)

**Fix:** Add translation keys to all three message files under a new `followUpEditor` namespace (or under the existing `forayDetail` namespace), then use `useTranslations` in the component:

```json
// messages/en.json — add under a new top-level key
"followUpEditor": {
  "noneSet": "No follow-up set",
  "set": "Set follow-up",
  "display": "Follow-up: {date}",
  "edit": "Edit",
  "clear": "Clear",
  "clearAriaLabel": "Clear follow-up date",
  "pickDate": "Pick a date",
  "save": "Save",
  "saving": "Saving...",
  "cancel": "Cancel",
  "tomorrow": "Tomorrow",
  "nextWeek": "Next week",
  "nextMonth": "Next month"
}
```

Then in `follow-up-editor.tsx`, add `'use client'` + `useTranslations('followUpEditor')` and replace all hardcoded strings with `t('key')` calls. The component already has `'use client'` so this is a straightforward addition.

### WR-02: ApplicationDetail has hardcoded English section headers

**File:** `src/features/applications/components/application-detail.tsx:58,74`
**Issue:** Two section headers are hardcoded in English instead of using the existing `t()` function from the `forayDetail` namespace:
- Line 58: `<h2>Follow-up</h2>` -- not using `t()`
- Line 74: `<h2>Tags</h2>` -- not using `t()`

Other headers in the same file correctly use `t('stages')`, `t('notes')`, `t('timeline')`.

**Fix:** Add `followUp` and `tags` keys to the `forayDetail` namespace in all three message files, then use `t()`:

```tsx
// application-detail.tsx
<h2 className="text-xl font-medium">{t('followUp')}</h2>
// ...
<h2 className="text-xl font-medium">{t('tags')}</h2>
```

```json
// messages/en.json — add to forayDetail
"followUp": "Follow-up",
"tags": "Tags"
```

### WR-03: NavLinks badge aria-label is hardcoded English

**File:** `src/components/nav-links.tsx:31`
**Issue:** The follow-ups badge uses a hardcoded English aria-label: `` `${t(key)} (${overdueCount} follow-ups due)` ``. This means screen readers on non-English locales will announce English text. The component does not currently import or use translations for this specific string.

**Fix:** Add a translation key for the badge label (e.g., `nav.followUpsBadge` = `"{count} follow-ups due"`) and use it in the aria-label. Alternatively, since `NavLinks` is a client component, pass the translated string from `NavLinksWrapper` (server component) as a prop.

## Info

### IN-01: No-op cron job "reminder-check" runs every 15 minutes

**File:** `src/instrumentation.ts:22-29`
**Issue:** The `reminder-check` cron job is registered with a `*/15 * * * *` schedule but its handler only logs a message -- it performs no actual work. The Today page already fetches overdue follow-ups on demand via `findOverdueFollowUps`. Running an empty job every 15 minutes adds advisory lock acquisition overhead and log noise for no current benefit.

**Fix:** This is acceptable as a hook for future notification logic (the comment says as much). Consider removing the job until notification logic is ready, or adding a `// TODO(dpham, 2026-05-10): implement notification delivery` marker to make the intent explicit.

### IN-02: Redundant userId filtering in withRls-scoped queries

**File:** `src/features/today/queries.ts` (multiple functions)
**Issue:** Functions like `findStaleForays`, `findOfferForays`, `findOverdueFollowUps`, `getPipelineCounts`, `findThisWeekCounts`, and `findRecent24hActivity` all pass `userId: Number(userId)` in Prisma `where` clauses despite running inside `withRls(userId, ...)` which already sets the Postgres RLS context. The userId filter is redundant with RLS enforcement.

**Fix:** No action needed. This is intentional defense-in-depth per PRINCIPLES.md: "`tenantDb` is the primary line of defense. RLS is the safety net." The explicit userId filter in Prisma queries serves as the primary defense; RLS is the belt-and-suspenders layer. Documenting this pattern with a brief comment in one representative function would help future readers understand the intent.

### IN-03: Non-null assertion on followUpAt after filter

**File:** `src/features/today/queries.ts:218-219`
**Issue:** In `findOverdueFollowUps`, the code filters `r.followUpAt !== null` then uses `r.followUpAt!` in the map. TypeScript does not narrow through `.filter()`, so the `!` assertion is necessary. However, the Prisma `where` clause already has `not: null`, making the JS filter doubly redundant.

**Fix:** No code change needed. The `not: null` in the Prisma where clause is the real guard; the JS filter is a TypeScript type-narrowing workaround. The `!` assertions are safe given the query constraints. A type predicate in the filter (`(r): r is ... & { followUpAt: Date }`) would be more explicit but adds complexity for marginal benefit.

---

_Reviewed: 2026-05-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
