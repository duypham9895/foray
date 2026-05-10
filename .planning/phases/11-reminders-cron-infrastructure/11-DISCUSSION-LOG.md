# Phase 11: Reminders + Cron Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 11-reminders-cron-infrastructure
**Areas discussed:** Follow-up editor UX, Follow-ups section display, Count badge behavior, CronRegistry API shape

---

## Follow-up editor UX

### Location in detail view

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated section | Follow-up date gets its own section between StageEditor and NotesEditor, with a date picker and quick-set buttons. Consistent with existing section pattern. | ✓ |
| Inline in header | Follow-up date sits in the header area next to appliedOn date and StatusBadge. Compact, always visible, but crowds the header. | |
| Popover from header icon | Small follow-up icon/button in the header that opens a popover with date picker. Minimal footprint, but hidden until clicked. | |

**User's choice:** Dedicated section (Recommended)
**Notes:** Consistent with existing section pattern in application detail view.

### Quick-set shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Quick-set buttons | Buttons like "Tomorrow", "Next week", "Next month" alongside the date picker. Fast for common follow-up intervals. | ✓ |
| Date picker only | Just a plain date input. Simple, no extra UI. Owner picks any date manually. | |
| Date picker + note | Date picker plus a small text input for notes like "Follow up after the weekend". More context but more UI. | |

**User's choice:** Quick-set buttons (Recommended)
**Notes:** Common follow-up intervals cover most use cases.

### Clear behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clear button | "Clear" button appears next to the date when a follow-up is set. One click to remove. | ✓ |
| Toggle off by re-clicking | Clicking the already-selected date deselects it. Toggle behavior — less discoverable but fewer buttons. | |
| You decide | Best approach based on the component pattern. | |

**User's choice:** Clear button (Recommended)
**Notes:** More discoverable than toggle behavior.

### Display state

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible state | Section always shows current state: "Follow-up: May 15" or "No follow-up set" with an Edit button. Owner sees the state without clicking. | ✓ |
| Show only when set | Section shows only when a follow-up is set. Empty state is just the "Set follow-up" button. Cleaner when no follow-up exists. | |

**User's choice:** Always-visible state (Recommended)
**Notes:** Owner always sees current state without clicking.

---

## Follow-ups section display

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All overdue | Show all overdue follow-ups regardless of how long they've been overdue. Owner sees full picture of what's slipping. | ✓ |
| Due today only | Only show follow-ups due today or earlier this week. Keeps the section focused on immediate action items. | |
| Overdue + upcoming | Show overdue plus upcoming (next 3 days). Helps owner plan ahead, not just react. | |

**User's choice:** All overdue (Recommended)
**Notes:** Full picture of what's slipping.

### Sorting

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest first | Most overdue first (oldest follow-up date at top). Surfaces the most urgent items. | ✓ |
| Newest first | Most recently overdue first (closest to today at top). Surfaces items that just became due. | |
| You decide | Sorting based on what makes most sense. | |

**User's choice:** Oldest first (Recommended)
**Notes:** Most urgent items surface first.

### Card info

| Option | Description | Selected |
|--------|-------------|----------|
| Role + company + days overdue | Role title, company, how many days overdue, and a link to the application detail. Matches existing card patterns. | ✓ |
| Add status badge too | Role title, company, days overdue, plus the current canonicalStatus badge. More context but denser. | |
| You decide | Card content based on the existing Today card patterns. | |

**User's choice:** Role + company + days overdue (Recommended)
**Notes:** Matches existing card patterns, keeps it clean.

### Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Click to navigate | Clicking the card navigates to the application detail page where they can update the follow-up. Simple, consistent with other Today cards. | ✓ |
| Inline actions | Card has a "Mark done" or "Snooze" action inline. More power but more UI complexity. | |
| You decide | Interaction model. | |

**User's choice:** Click to navigate (Recommended)
**Notes:** Simple, consistent with other Today cards.

---

## Count badge behavior

### Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Show only when > 0 | Badge only appears when count > 0. Clean nav when nothing is overdue. Disappears when owner clears all follow-ups. | ✓ |
| Always show count | Badge always visible, showing "0" when nothing is overdue. Consistent but potentially noisy. | |

**User's choice:** Show only when > 0 (Recommended)
**Notes:** Clean nav when nothing is overdue.

### Count scope

| Option | Description | Selected |
|--------|-------------|----------|
| Overdue only | Badge counts only overdue follow-ups (followUpAt <= now). Matches the "Follow-ups due" section scope. | ✓ |
| Overdue + upcoming | Badge counts overdue + upcoming (next 3 days). Gives a broader picture but may feel noisy. | |

**User's choice:** Overdue only (Recommended)
**Notes:** Matches the "Follow-ups due" section scope.

### Visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Number pill | Small colored pill with the number inside (e.g., "3"). Standard badge pattern, high visibility. | ✓ |
| Dot indicator | Small colored dot without a number. Indicates something needs attention without showing count. | |
| You decide | Visual style based on the existing nav design. | |

**User's choice:** Number pill (Recommended)
**Notes:** Standard badge pattern, high visibility.

---

## CronRegistry API shape

### Registration pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Job array pattern | Simple array of job definitions (name, schedule, handler) registered at startup. Registry iterates and starts each. Minimal abstraction, easy to extend. | ✓ |
| Class-based registry | Class-based registry with register(), start(), stop(), status() methods. More structure but heavier for 2 jobs. | |
| You decide | API shape based on what the codebase needs. | |

**User's choice:** Job array pattern (Recommended)
**Notes:** Minimal abstraction for 2 jobs, easy to extend.

### Guard handling

| Option | Description | Selected |
|--------|-------------|----------|
| Registry handles guards | Registry absorbs the 4 existing guards (NEXT_RUNTIME, NODE_ENV, globalThis, advisory lock). Job definitions only need name + schedule + handler. | ✓ |
| Per-job guard config | Each job definition includes its own guard configuration. More flexible but repetitive. | |
| You decide | How guards are managed. | |

**User's choice:** Registry handles guards (Recommended)
**Notes:** Centralized guard management, cleaner job definitions.

### Observability

| Option | Description | Selected |
|--------|-------------|----------|
| Log-only | Registry logs job start/finish/errors via Pino. No runtime API — just structured logs for debugging. | ✓ |
| Status API | Registry exposes a status() method that returns last-run time, next-run time, and error count per job. Useful for future health dashboard. | |
| You decide | Observability level. | |

**User's choice:** Log-only (Recommended)
**Notes:** Structured logs sufficient for debugging.

---

## Claude's Discretion

Badge color, quick-set button labels and date offsets, empty state copy, CronRegistry file location — deferred to implementation.

## Deferred Ideas

None — discussion stayed within phase scope.
