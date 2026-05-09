# Research: Standard Phase 1 - Bookmarklet + Capture API

**Phase**: Standard-1  
**Goal**: One-click job capture from any webpage with prefilled form  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Users manually navigate to Foray, click "New Application", and type in job details from another tab (LinkedIn, Greenhouse, email, etc.).

**Friction points**:
- Context switching (copy title, paste URL, type company name)
- Easy to forget details
- Repetitive data entry
- Takes ~1-2 minutes per job

**Solution**: One-click bookmarklet that:
- Extracts page title, URL, selected text automatically
- Sends to API endpoint
- Redirects to prefilled form
- Reduces time to <30 seconds

---

## Bookmarklet Technical Constraints

1. **Browser compatibility**: Works in Chrome, Firefox, Safari (99%+ coverage)
2. **CSP limitations**: Must work on sites with strict Content Security Policy (e.g., LinkedIn)
   - Workaround: Use `javascript:` URL format (allowed in bookmarks)
   - No external script loading
   - Pure vanilla JS, no dependencies

3. **Size limit**: Bookmarklet URLs have ~2000 char limit
   - Minification + URL encoding required
   - No large libraries (jQuery, React, etc.)

4. **Cross-origin**: Bookmarklet runs on user's domain, posts to our API
   - CORS headers required on `/api/capture`
   - Same-origin policy allows bookmarks to POST

---

## IIFE Pattern (Why We Use It)

```javascript
(function() {
  // Isolated scope, no global pollution
  // Instantly invoked when bookmarklet runs
  // No variable conflicts with page's JS
})();
```

---

## Data Flow

```
User on LinkedIn job page
    ↓ clicks "Add to Foray" bookmarklet
    ↓ executes JavaScript in page context
    ↓ collects: title, URL, selected text
    ↓ POST to /api/capture (CORS-safe)
    ↓ server validates, rejects ATS domains
    ↓ returns redirectUrl with base64 prefill
    ↓ bookmarklet opens new tab to /applications/new?prefilled=...
    ↓ form auto-populates from query params
    ↓ user reviews + submits
```

---

## ATS Domain Blocking Rationale

**Why block Greenhouse, Workday, Lever, Ashby?**

These platforms have restrictive ToS that prohibit automated data extraction. Instead of:
- Creating friction (block bookmarklet)
- Violating ToS (scrape anyway)

We **educate users**: "Fill these manually in their system, link the result." This:
- Respects platform ToS
- Gives users confidence (no legal risk)
- Still captures the job in Foray

---

## Performance Targets

- Bookmarklet execution: <100ms
- API response: <200ms
- Page load after redirect: <500ms
- **Total UX time**: <30 seconds (vs. 1-2 minutes manual)

---

## Fallback Strategy (If Browser CSP Breaks Bookmarklet)

If a site's CSP prevents bookmarklet execution:
- Graceful error: `alert("Bookmarklet blocked on this site. Copy/paste manually:")`
- User can still manually create application

No hard dependency on bookmarklet working everywhere.

---

## Acceptance Criteria Rationale

✅ **Source file exists** → Can verify bookmarklet syntax + size  
✅ **URL-encoded** → Can be dragged to bookmark bar  
✅ **CORS headers** → Cross-origin POST succeeds  
✅ **Form prefill** → Reduces manual data entry to review-only  
✅ **ATS rejection** → Respects platform ToS, educates user  
✅ **Pre-commit gates** → No regressions in existing features

