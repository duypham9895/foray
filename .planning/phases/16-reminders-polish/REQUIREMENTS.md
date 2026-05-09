# Requirements: Phase 16 - Reminders + Polish

**Phase**: Full-6  
**Derived from**: FULL-ROADMAP.md Phase 6  
**Maps to**: Plans 16-01, 16-02, 16-03, 16-04

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| REM-01 | Cron job sends 1-day interview reminders | 16-01 | Stage 1 day away → Email sent with details |
| REM-02 | Cron job sends 1-hour interview reminders | 16-01 | Stage 1 hour away → Email sent with Zoom link (if available) |
| REM-03 | Reminder tracking (don't send duplicates) | 16-01 | reminder_sent_1day flag prevents duplicate emails |
| REM-04 | In-app notification toast for recruiter emails | 16-02 | Email from recruiter → Toast shows "New email from {name}" |
| REM-05 | Settings page for notification preferences | 16-02 | User can toggle reminder frequency + timing |
| REM-06 | Visual polish: spacing, colors, typography consistent | 16-03 | All components use design system tokens |
| REM-07 | Edge case handling: empty states, error messages, loading states | 16-03 | All edge cases show clear feedback (no blank screens) |
| REM-08 | Accessibility audit: ARIA labels, keyboard nav, contrast | 16-03 | Tab through all pages, all interactive elements accessible |
| REM-09 | Multi-undo stack (up to 5 actions) | 16-04 | Undo multiple actions, revert to earlier state |
| REM-10 | Performance optimization: Lighthouse >90 on all categories | 16-04 | Run Lighthouse, all scores ≥90 |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Email delivery latency | <30 seconds (async queue) |
| Performance | Bundle size | <500KB gzipped |
| Performance | Lighthouse score | >90 all categories (Performance, Accessibility, Best Practices, SEO) |
| Reliability | Reminder delivery | 100% success rate (retries on failure) |
| Usability | Toast notification visibility | Auto-dismiss after 5 seconds (or on close) |
| Usability | Settings are persistent | Preferences saved to database + survive reload |
| Accessibility | WCAG AA compliance | Key user flows accessible via keyboard |
| Accessibility | Color contrast ratio | 4.5:1 on all text (WCAG AA) |

---

## Boundary Conditions

- **Reminder timing**: 1 day + 1 hour before (fixed, not user-configurable in Phase 16)
- **In-app notifications**: Only for recruiter emails (not every email)
- **Undo stack**: Max 5 actions (older actions removed)
- **Polish scope**: UI/UX only (no architectural changes)

---

## Success Criteria

- [ ] Cron job for interview reminders working
- [ ] 1-day + 1-hour reminder emails sent correctly
- [ ] Reminder tracking prevents duplicates
- [ ] In-app toast notifications for recruiter emails
- [ ] Settings page with notification preferences
- [ ] All components visually consistent (spacing, colors, typography)
- [ ] Edge cases handled: empty states, errors, loading
- [ ] Keyboard navigation works throughout app
- [ ] ARIA labels on all interactive elements
- [ ] Multi-undo stack implementation complete
- [ ] Lighthouse audit scores >90
- [ ] Bundle size <500KB gzipped
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: All core features exist
- **Full-1 through Full-5 complete**: All Full features exist
- **Email service**: SMTP or SendGrid for reminder emails
- **Cron job runner**: Node-cron or similar for scheduled tasks
- **Design system tokens**: CSS variables for consistent spacing/colors
- **Accessibility testing**: WAVE browser extension or axe DevTools

---

## Out of Scope (Phase 16)

- SMS reminders (email only)
- Push notifications (browser Notifications API beyond toasts)
- Notification aggregation (digest emails) — could be future phase
- Advanced ML-based optimization
- Native mobile apps

---

## Integration Points

- **Standard-4**: Keyboard shortcuts + undo integration
- **Full-4**: Calendar integration (use Zoom link in reminders)
- **Full-5**: Analytics can show reminder engagement
- **Post-launch**: User feedback drives Phase 17+ prioritization

---

## API Endpoints

- `POST /api/reminders/send` → Manual trigger reminder send (admin)
- `GET /api/settings/notifications` → User notification preferences
- `PUT /api/settings/notifications` → Update preferences
- `GET /api/notifications?limit=10` → Notification history

---

## Database Schema Changes

```prisma
model Stage {
  // ... existing fields
  
  reminderSent1Day Boolean @default(false)
  reminderSent1Hour Boolean @default(false)
  
  @@index([stageDate])  // For cron job query
}

model UserSettings {
  id Int @id
  userId String @unique
  
  // Notifications
  reminderFrequency String  // 'immediate', 'daily_digest', 'none'
  reminderTiming Json       // { oneDay: true, oneHour: true }
  
  // Preferences
  timezone String
  theme String  // 'light', 'dark', 'system'
  keyboardHints Boolean
  
  @@index([userId])
}
```

---

## Testing Strategy

- Unit tests: Reminder logic (time calculations)
- Integration tests: Cron job execution, email sending
- Email tests: Template rendering, variables substitution
- A11y tests: ARIA attributes, keyboard navigation
- Performance tests: Bundle size analysis, Lighthouse audit
- E2E tests: Full undo stack, settings persistence
- Visual tests: Consistency across all pages

---

## Acceptance Sign-Off Checklist (Final)

**Before declaring project complete**:
- [ ] All 54 phases complete (Lean 5 + Standard 5 + Full 6)
- [ ] All 100+ tests passing (green CI)
- [ ] All pre-commit gates passing (lint, typecheck, build, depcheck)
- [ ] Lighthouse scores >90
- [ ] No open bugs (issues triage complete)
- [ ] User documentation complete (README, guides)
- [ ] All commits are atomic + well-documented
- [ ] ROADMAP.md shows all phases complete
- [ ] Project ready for user launch or presentation

---

*Phase 16 is the final chapter. Bring the product to shippable, polished state.*
