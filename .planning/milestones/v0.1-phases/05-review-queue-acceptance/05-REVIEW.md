---
phase: 05-review-queue-acceptance
reviewed: 2026-05-09T10:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - docs/milestones/lean.md
  - scripts/check-server-actions.ts
  - src/app/api/inbox/full-body/route.ts
  - src/app/inbox/page.tsx
  - src/core/env.test.ts
  - src/features/inbox/actions.test.ts
  - src/features/inbox/actions.ts
  - src/features/inbox/components/classification-select.tsx
  - src/features/inbox/components/confidence-badge.tsx
  - src/features/inbox/components/degradation-banner.tsx
  - src/features/inbox/components/inbox-list.tsx
  - src/features/inbox/components/inbox-row.tsx
  - src/features/inbox/components/link-application-dialog.tsx
  - src/features/inbox/queries.test.ts
  - src/features/inbox/queries.ts
  - src/features/inbox/schema.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-09T10:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the inbox review queue feature: server actions, API route, page component, client components, queries, and schema. The architecture follows the project's vertical slice pattern well — `tenantDb` usage is consistent, `requireUser()` guards every action, and RLS transactions are used correctly. Three warnings found: missing Zod validation in server actions (despite schemas existing in `schema.ts`), silent failure on action errors in the UI, and unhandled Gmail API errors in the full-body route.

## Warnings

### WR-01: Server actions accept raw parameters without Zod validation

**File:** `src/features/inbox/actions.ts:58-168`
**Issue:** All four review actions (`confirmClassification`, `overrideClassification`, `linkToApplication`, `ignoreEmail`) accept raw parameters directly without Zod `safeParse`. The project already defines matching schemas in `src/features/inbox/schema.ts` (`reviewActionSchema`, `overrideClassificationSchema`, `linkApplicationSchema`) but they are unused. Per PRINCIPLES.md: "Every input from outside the trust boundary (form data, request body, URL params, env vars, external API responses) goes through `safeParse` before use." Server Actions are public HTTP endpoints — a crafted request could pass `emailId: -1` or `newClassification: "invalid_value"`.

**Fix:**
```typescript
import { reviewActionSchema, overrideClassificationSchema, linkApplicationSchema } from './schema'

export async function confirmClassification(
  emailId: number,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = reviewActionSchema.safeParse({ emailId })
  if (!parsed.success) return { ok: false, error: 'Invalid input' }
  // ... rest of function using parsed.data.emailId
}
```

### WR-02: Inbox action handlers silently fail on server errors

**File:** `src/features/inbox/components/inbox-list.tsx:30-58`
**Issue:** All four action handlers (`handleConfirm`, `handleOverride`, `handleLink`, `handleIgnore`) check `result.ok` but do nothing when it's `false`. If a server action fails (DB error, validation error), the user gets no feedback — the row stays in place with no indication of what happened. This violates the project's error handling philosophy of surfacing errors explicitly.

**Fix:** Add error toast or inline error state:
```typescript
const handleConfirm = async (emailId: number) => {
  const result = await confirmClassification(emailId)
  if (result.ok) {
    setEmails((prev) => prev.filter((e) => e.id !== emailId))
  } else {
    // TODO: integrate with toast system when available
    console.error(`Failed to confirm: ${result.error}`)
  }
}
```

### WR-03: Gmail API call has no error handling for network/not-found failures

**File:** `src/app/api/inbox/full-body/route.ts:76-80`
**Issue:** `gmail.users.messages.get()` can throw on network errors, invalid message IDs, or Gmail API failures (404, 403, 500). This would result in an unhandled exception returning a generic 500 to the client. The handler should catch and return a structured error response.

**Fix:**
```typescript
let msg: gmail_v1.Schema$Message
try {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'full',
  })
  msg = response.data
} catch (err) {
  return NextResponse.json(
    { error: 'Failed to fetch email from Gmail' },
    { status: 502 },
  )
}
```

## Info

### IN-01: Type assertion bypasses type safety in ClassificationSelect

**File:** `src/features/inbox/components/classification-select.tsx:34`
**Issue:** `value as EmailClassification` casts the string value directly. While safe at runtime (values come from the hardcoded `CLASSIFICATIONS` array), a type guard would be more defensive and match the project's "honesty over cleverness" principle.

**Fix:** Add a type guard or use the array to validate:
```typescript
const isValidClassification = (v: string): v is EmailClassification =>
  CLASSIFICATIONS.some((c) => c.value === v)

onValueChange={(value) => {
  if (isValidClassification(value)) onOverride(emailId, value)
}}
```

### IN-02: `toLocaleDateString()` may produce inconsistent output across server/client

**File:** `src/features/inbox/components/inbox-row.tsx:73`
**Issue:** `item.receivedAt.toLocaleDateString()` uses the runtime's locale, which may differ between the server (Node.js) and the client (browser). This can cause hydration mismatches. Low risk since the date is rendered in a client component (no SSR hydration issue), but the format may not match user expectations.

**Fix:** Use a deterministic format:
```typescript
new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(item.receivedAt)
```

### IN-03: `useState(items)` won't update if parent re-renders with new props

**File:** `src/features/inbox/components/inbox-list.tsx:28`
**Issue:** `const [emails, setEmails] = useState(items)` captures the initial props and ignores subsequent prop changes. If the parent re-renders with updated items (e.g., after a background sync), the list won't reflect them. For the current review queue use case (items are removed on action, not added), this is acceptable behavior. Flagging for awareness if the component is reused elsewhere.

**Fix:** No action needed for current use case. If future requirements need prop sync, use a key prop or `useEffect`:
```typescript
useEffect(() => { setEmails(items) }, [items])
```

---

_Reviewed: 2026-05-09T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
