# Requirements: Standard Phase 1

**Derived from**: STANDARD-ROADMAP.md  
**Maps to**: Plans 01-01, 01-02, 01-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| BOOK-01 | Bookmarklet captures title, URL, selected text | 01-01 | Inspect `foray.js` exports capturePageInfo() |
| CAPT-02 | `/api/capture` accepts POST and returns redirectUrl | 01-02 | POST returns 200 + redirectUrl in response |
| CAPT-03 | Form prefills from query params | 01-02 | Navigate to `/applications/new?prefilled=...`, verify input values |
| BOOK-02 | Bookmarklet draggable from settings page | 01-03 | Drag to bookmark bar, click on job page → modal opens |
| BLOCK-01 | ATS domains rejected client & server-side | 01-02, 01-03 | POST greenhouse.io URL → 400 error + clear message |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Bookmarklet execution time | <100ms |
| Performance | API response time | <200ms |
| Compatibility | Browser support | Chrome, Firefox, Safari (99%+) |
| Security | CORS properly configured | No *Allow-Origin: * (specific origin) |
| Security | No credentials leaked | API responses don't include tokens |
| Usability | Error messages clear | User understands why action failed |
| Reliability | Graceful degradation | Fallback if CSP blocks bookmarklet |

---

## Boundary Conditions

- **Bookmarklet size**: Must stay under 2000 chars when URL-encoded
- **Form data size**: Query params must not exceed URL length limits (~2000 chars)
- **ATS list**: Greenhouse, Workday, Lever, Ashby, SmartRecruiters (extensible)
- **CORS scope**: Allows bookmarklet from any origin, validates on server

---

## Success Criteria (From Roadmap)

- [ ] Bookmarklet source in `bookmarklet/foray.js` exists and exports functions
- [ ] Build step minifies + URL-encodes into `javascript:...` form
- [ ] `/api/capture` endpoint accepts POST, validates, returns redirectUrl
- [ ] Form rejects ATS domains client-side and server-side
- [ ] All pre-commit checks pass

---

## Dependencies

- **Lean complete**: Database, auth, existing UI patterns
- **No external dependencies**: Pure vanilla JavaScript
- **No new npm packages**: Build uses existing Vite + terser

---

## Out of Scope (Intentionally NOT in Phase 1)

- Native extension (saved for Full-1)
- Site-specific scrapers (only basic title/URL extraction)
- AI-powered field detection (bookmarklet just captures what user sees)
- Offline bookmarklet functionality (requires server)

