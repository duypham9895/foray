# Requirements: Phase 11 - Chrome MV3 Extension

**Phase**: Full-1  
**Derived from**: FULL-ROADMAP.md Phase 1  
**Maps to**: Plans 11-01, 11-02, 11-03, 11-04

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| EXT-01 | manifest.json exists with correct permissions | 11-01 | File exists, contains activeTab + scripting + <all_urls> |
| EXT-02 | Content script injects + sends page data on message | 11-01 | chrome.tabs.sendMessage receives {title, url, selectedText} |
| EXT-03 | Service worker receives message + calls `/api/capture` | 11-02 | POST succeeds, returns redirectUrl |
| EXT-04 | Popup shows current page title + "Capture" button | 11-02 | Click extension icon → popup appears with title |
| EXT-05 | Clicking "Capture" extracts data + sends to API | 11-03 | Click button → API called with correct data |
| EXT-06 | Success response shows link to edit in Foray | 11-03 | Popup displays "Added! Edit in Foray" with link |
| EXT-07 | ATS domain blocking (client-side warning) | 11-04 | greenhouse.io URL → alert shown, not captured |
| EXT-08 | Extension loads without errors in Chrome | 11-04 | `chrome://extensions/` → load unpacked → extension appears |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Compatibility | Works on Chrome/Edge 90+ | Tested on latest 2 versions |
| Security | No remote script loading | All JS inline or local |
| Security | Minimal permissions requested | Only activeTab, scripting, <all_urls> |
| Usability | Popup appears instantly | <100ms from click to render |
| Usability | Error messages clear | User understands failure reason |
| Reliability | Extension doesn't crash browser | Graceful error handling |

---

## Boundary Conditions

- **Chrome version**: MV3 requires Chrome 88+ (2021+)
- **Permission scope**: `<all_urls>` for universal capture (unlike bookmarklet CSP limits)
- **ATS list**: Same as bookmarklet (Greenhouse, Workday, Lever, Ashby, SmartRecruiters)
- **Payload size**: No limit (unlike 2000-char bookmarklet limit)

---

## Success Criteria

- [ ] Extension directory structure created
- [ ] manifest.json valid + passes validation
- [ ] Content script injects without errors
- [ ] Service worker message handling works
- [ ] Popup UI renders + button is clickable
- [ ] Extension loads in Chrome (chrome://extensions/)
- [ ] Capture flow works (extension → API → Foray)
- [ ] ATS domain blocking triggers correctly
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: `/api/capture` endpoint exists and works
- **Chrome 88+**: MV3 requires modern Chrome
- **No new npm packages**: Use native Chrome APIs

---

## Out of Scope (Phase 11)

- Chrome Web Store publishing (manual process, not coded)
- Auto-update from Web Store (handled by Chrome)
- Document upload (saved for Full-2)
- Recruiter lookup (saved for Full-3)
- Calendar integration (saved for Full-4)
- Analytics popup (saved for Full-5)

---

## Integration Points

- **Standard-1**: Reuses `/api/capture` endpoint (no changes needed)
- **Full-2**: Extension can be enhanced to upload documents
- **Full-3**: Popup can show recruiter info (requires Full-3 entity)
- **Full-4**: Popup can display interview schedule
- **Full-5**: Popup can show user analytics

---

## Testing Strategy

- **Unit tests**: Content script message handling (send/receive)
- **Integration tests**: Service worker + API calls
- **Manual tests**: Load in Chrome, click extension, verify capture works
- **E2E tests**: Full flow (bookmarklet capture now tested via extension)

---

## Documentation Required

- `extension/README.md`: How to load extension locally for development
- `extension/MANIFEST.md`: Explanation of each permission
- Inline code comments in service-worker.js + content-script.js
