# Research: Phase 11 - Chrome MV3 Extension

**Phase**: Full-1  
**Goal**: Native Chrome extension replacing bookmarklet with full browser integration  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Bookmarklet in Phase 6 requires manual drag-to-bookmark and works on any site. But bookmarklets have limitations (CSP blocks, size constraints, discovery issues).

**Friction points**:
- Users must find and drag bookmarklet to bookmark bar
- Bookmarklet fails on sites with strict CSP
- No persistent UI (must click manually each time)
- Cannot access browser context (tabs, history)

**Solution**: Native Chrome extension (MV3) that:
- Auto-installs once (no manual setup)
- Adds icon to extension bar
- Click icon → capture current tab
- Integrates with Chrome's data (open tabs, history for smarter capture)
- Works everywhere (no CSP issues)

---

## Manifest V3 (MV3) Architecture

**Why MV3?**:
- Chrome required migration from MV2 (deprecated)
- MV3 enforces security (no remote scripts, stricter permissions)
- MV3 has content scripts + service workers (more powerful than bookmarklet)

**Extension structure**:
```
extension/
├── manifest.json           (permissions, icon, content scripts)
├── service-worker.js       (background logic, message handling)
├── content-script.js       (page context, DOM access)
├── popup.html              (click icon → shows UI)
├── popup.js                (popup logic)
├── styles.css
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

---

## Manifest.json Permissions

**Minimal permissions** (respect user privacy):
```json
{
  "manifest_version": 3,
  "name": "Foray Job Tracker",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "tabs",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon-128.png"
  }
}
```

**Explanation**:
- `activeTab`: Access current tab (only when user clicks extension icon)
- `tabs`: Query open tabs (for future features like tab grouping)
- `scripting`: Inject content scripts
- `<all_urls>`: Work on any website (no CSP issues)

---

## Content Script Injection Pattern

**Problem**: Bookmarklet runs in page context, has access to document + window. Content scripts run in isolated context.

**Solution**: Message passing between content script ↔ popup:

```typescript
// content-script.js (isolated context)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    // Capture page data (title, URL, selected text)
    const data = {
      title: document.title,
      url: window.location.href,
      selectedText: window.getSelection().toString(),
    };
    sendResponse(data);
  }
});

// popup.js
document.getElementById('captureButton').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'capture' }, (response) => {
    // Send data to Foray API
    fetch('/api/capture', { method: 'POST', body: JSON.stringify(response) });
  });
});
```

---

## Service Worker (Background Script)

Service workers replace background pages in MV3. They:
- Start only when needed
- Handle messaging from content scripts + popup
- Execute long-running logic (API calls)
- Cannot access DOM (no page context)

```typescript
// service-worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureAndSend') {
    // Make API call
    fetch('/api/capture', { method: 'POST', body: JSON.stringify(request.data) })
      .then(res => res.json())
      .then(data => sendResponse({ redirectUrl: data.redirectUrl }));
    return true; // Keep channel open for async response
  }
});
```

---

## Popup UI

**Popup appears when user clicks extension icon**:
1. Show current page title
2. Show "Capture" button
3. On click:
   - Extract page data (via content script)
   - Send to Foray API
   - Display success message or error
   - Show link to edit in Foray

**No form in popup** (all form prefill happens on Foray side, like bookmarklet).

---

## ATS Domain Blocking in Extension

**Same logic as bookmarklet**, but now enforced by:
1. Content script checks URL before capturing
2. If ATS domain, show warning: "Fill this manually in their system"
3. Still allow user to force capture if they want

```typescript
const ATS_DOMAINS = ['greenhouse.io', 'workday.com', 'lever.co', 'ashby.com'];

if (ATS_DOMAINS.some(ats => window.location.href.includes(ats))) {
  alert('For ATS applications, please fill them out in their system first.');
  return;
}
```

---

## Installation & Publishing

**Development**:
```bash
# Load extension locally for testing
chrome://extensions/ → "Load unpacked" → select extension/ folder
```

**Publishing**:
- Submit to Chrome Web Store
- Requires developer account ($5 one-time fee)
- Manual review by Google (usually <1 week)
- Once published, users install with one click

---

## Comparison: Bookmarklet vs Extension

| Feature | Bookmarklet | MV3 Extension |
|---------|-----------|---------------|
| CSP handling | Breaks on strict CSP | Works everywhere |
| Installation | Manual drag-to-bar | One-click install |
| UI | None (execute only) | Popup on demand |
| Permissions | None requested | Explicit permissions |
| Size | <2000 chars | Unlimited |
| Discovery | Hard to find | Auto-appears in extensions menu |
| Maintenance | Update requires re-drag | Auto-updates |

---

## Future Extension Hooks (Phase 11 only captures data)

Later phases can enhance extension:
- **Full-2**: Add document attachment upload from extension
- **Full-3**: Show recruiter info in extension popup (quick lookup)
- **Full-4**: Calendar integration (show interview schedule from extension)
- **Full-5**: Analytics (show foray stats in popup)

Phase 11 is the foundation. Subsequent phases build on it.

---

*Phase 11 replaces bookmarklet with proper browser integration. Same data flow, better UX.*
