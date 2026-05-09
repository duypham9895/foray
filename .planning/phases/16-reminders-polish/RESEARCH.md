# Research: Phase 16 - Reminders + Polish

**Phase**: Full-6  
**Goal**: Proactive notifications for interviews + final UX refinement  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Interview is scheduled in calendar + Foray, but user might forget.

**Friction points**:
- No reminder for upcoming interview
- Easy to miss recruiter emails
- Polish issues from earlier phases (visual inconsistency, edge cases)

**Solution**: 
- Email reminders before interviews (1 day before, 1 hour before)
- In-app notifications for incoming recruiter emails
- Final UX refinement (visual polish, accessibility, edge cases)

---

## Reminder Types

**Interview Reminders**:
```
1 day before: "You have a Final Interview at Acme Inc tomorrow at 10am"
1 hour before: "Interview starts in 1 hour! Join Zoom meeting"
```

**Recruiter Email Reminders** (optional):
```
"New email from John Smith (recruiter): 'Your final round feedback...'"
```

**Offer Reminder**:
```
"You got an offer from Acme Inc! Review on page"
```

---

## Email Reminder Implementation

**Trigger**: Scheduled cron job (every hour).

**Logic**:
```
For each stage where stageDate is within [now, now + 25 hours]:
  Check if reminder already sent (reminder_sent_1day = true)
  If not: Send email, set flag
```

**Email template**:
```
Subject: Reminder: Interview at {Company} {Role} tomorrow at {time}

Your interview is coming up:
- Company: {Company}
- Role: {Role}
- Stage: {Stage}
- Time: {Date} at {Time}
- Zoom: {Zoom Link} (if available from calendar event)

See full details: https://foray.app/applications/{appId}
```

---

## In-App Notification Strategy

**Toast notifications**:
```
User receives email from recruiter X
  ↓
Check if recruiter is known (linked to application)
  ↓
If yes: Show toast "New email from {recruiter}: {subject}"
  ↓
User can click → view email in context
```

**Notification center** (optional for Phase 16):
- Historical notifications (last 7 days)
- Mark as read/unread
- Archive old notifications

---

## Polish Tasks (From Earlier Phases)

**Visual Consistency**:
- Audit all UI components for consistent spacing, colors, typography
- Fix any color contrast issues (accessibility)
- Ensure mobile responsiveness across all pages

**Edge Cases**:
- Empty states all have helpful messaging (no blank screens)
- Error states show clear recovery steps
- Loading states are visible (no silent failures)
- Form validation gives specific feedback ("Email invalid: must contain @")

**Accessibility**:
- All buttons have `aria-label` 
- Links are distinguishable from text
- Keyboard navigation works throughout (Tab key)
- Color is not the only signal (not "red = error" without text)

**Performance**:
- Audit bundle size (should be <500KB gzipped)
- Lighthouse score target: >90 on all categories
- Optimize images (use WebP where supported)

---

## Multi-Undo Stack (Enhancement)

**Phase 9 had undo for delete**. Phase 16 can enhance:
```
User deletes stage, then deletes email, then modifies note
↓
Undo history: [Stage delete, Email delete, Note change]
↓
User can undo one action or undo all (last 5 actions)
```

**Implementation**:
```typescript
const undoStack = [
  { action: 'deleteStage', appId: 1, data: {...} },
  { action: 'deleteEmail', emailId: 2, data: {...} },
  { action: 'modifyNote', appId: 1, data: {...} },
];

function undo() {
  const last = undoStack.pop();
  executeReverse(last);  // Restore deleted item or revert change
}
```

---

## Settings Polish

**User preferences added in Phase 16**:
- Email notification frequency (immediate, daily digest, none)
- Reminder timing (1 day before, 2 days before, custom)
- Timezone (used by Phase 14 calendar integration)
- Keyboard shortcuts preference (show hints or not)
- Theme (light/dark mode)

---

## Final Verification

**Before Phase 16 complete**:
- [ ] All 54+ atomic commits reviewed (Lean 19 + Standard 15 + Full 20)
- [ ] 100+ tests passing (unit + integration + E2E)
- [ ] All features from roadmap implemented + documented
- [ ] No open bugs (issues triage complete)
- [ ] Lighthouse scores >90
- [ ] WCAG AA accessibility compliance (key flows)
- [ ] Performance benchmarks met (<500ms dashboard, <300ms search)
- [ ] User documentation complete

---

## Post-Launch Considerations

After Phase 16 completes:
- Monitor user feedback
- Track common error patterns
- Plan Phase 17+ (if company decides to continue)
- Consider: Native mobile apps, advanced AI features, team collaboration

---

*Phase 16 brings the product to polish finish. User-facing completeness + behind-the-scenes refinement.*
