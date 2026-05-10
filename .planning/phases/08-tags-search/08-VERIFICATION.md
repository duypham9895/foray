---
phase: 08-tags-search
verified: 2026-05-10T12:00:00Z
status: gaps_found
score: 2/5 must-haves verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Search bar searches across company, role title, notes, and tags"
    status: failed
    reason: "fullTextSearch queries roleTitle, notes, searchText on applications; subject, bodyExcerpt on emails; name on stages. Does NOT query Company.name or tags. The searchText denormalized field exists in schema but is never populated, making it dead code."
    artifacts:
      - path: "src/core/queries/search.ts"
        issue: "Missing Company.name search and tag search. searchText field queried but never populated."
      - path: "prisma/migrations/20260510150000_add_search_text_and_fulltext/migration.sql"
        issue: "GIN index created but searchText column never written to"
    missing:
      - "Add Company.name to search (join or separate query)"
      - "Add Application.tags to search OR tags column to searchText denormalization"
      - "Populate searchText field on application create/update (or remove dead field)"
  - truth: "Search results highlight matching text"
    status: failed
    reason: "No highlighting implementation exists. Search page renders roleTitle, companyName, subject, stage name as plain text with no <mark>, <em>, or highlight component."
    artifacts:
      - path: "src/app/search/page.tsx"
        issue: "Plain text rendering on lines 77-79 (applications), 113 (emails), 146 (stages). No highlight/markup of matched terms."
    missing:
      - "Implement HighlightText component or inline <mark> tags around matched substrings"
      - "Pass query to result rendering to identify match positions"
  - truth: "Tag management (rename, delete, merge) available in settings"
    status: failed
    reason: "Settings page has Gmail, Bookmarklet, and Language sections only. No tag management UI exists anywhere in the codebase."
    artifacts:
      - path: "src/app/settings/page.tsx"
        issue: "No tag management section. Only Gmail, Bookmarklet, Language."
    missing:
      - "Tag management section in /settings with rename, delete, and merge operations"
      - "Backend service functions for renameTag, deleteTag, mergeTags"
      - "UI components for tag list with edit/delete actions and merge dialog"
deferred: []
human_verification:
  - test: "Add and remove tags on an application detail page"
    expected: "Tags appear as removable badges; adding via autocomplete updates inline without page reload"
    why_human: "Server action behavior and inline update UX require browser interaction"
  - test: "Filter applications by tag using TagCloud"
    expected: "Clicking a tag in the cloud filters the list; clicking again clears the filter"
    why_human: "URL param filtering and list re-render require browser navigation"
  - test: "Search via /search page"
    expected: "Type query, see grouped results across applications, emails, and stages"
    why_human: "Full-text search results depend on live database content"
  - test: "Press / to focus search input"
    expected: "Global / keypress focuses the search input when not in a text field"
    why_human: "Keyboard shortcut behavior requires browser interaction"
---

# Phase 8: Tags + Search Verification Report

**Phase Goal:** User-defined tags on applications + full-text search across company names, roles, notes, and tags.
**Verified:** 2026-05-10T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Users can add/remove tags on applications (inline, no page reload) | VERIFIED | TagEditor (48 lines) uses useActionState + updateTagsAction server action. TagInput (189 lines) has full keyboard nav autocomplete with add/remove. Wired into application-detail.tsx lines 66-70. |
| 2 | Tags are filterable in the applications list | VERIFIED | TagCloud (43 lines) renders clickable badges with counts. Filter API at /api/applications/filter (36 lines) queries `tags: { has: tag }`. Wired into applications/page.tsx lines 119-131 with active filter state and clear link. |
| 3 | Search bar searches across company, role title, notes, and tags | FAILED | fullTextSearch (144 lines) searches roleTitle, notes, searchText on applications; subject, bodyExcerpt on emails; name on stages. Missing: Company.name (no company join) and tags (not in query). searchText field exists but never populated. |
| 4 | Search results highlight matching text | FAILED | No highlighting implementation. search/page.tsx (175 lines) renders results as plain text. No <mark>, <em>, or highlight component found anywhere in codebase. |
| 5 | Tag management (rename, delete, merge) available in settings | FAILED | Settings page (161 lines) has Gmail, Bookmarklet, and Language sections only. No tag management UI. No renameTag/deleteTag/mergeTags service functions exist. |

**Score:** 2/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/applications/tags-service.ts` | Tag CRUD + aggregation | VERIFIED | 181 lines. findAllTags, addTag, removeTag, findApplicationsByTag. All tenant-scoped via withRls. |
| `src/features/applications/components/tag-input.tsx` | Autocomplete tag input | VERIFIED | 189 lines. Keyboard nav (arrows, enter, escape, backspace), dropdown with filtered suggestions, removable badges. |
| `src/features/applications/components/tag-cloud.tsx` | Clickable tag list with counts | VERIFIED | 43 lines. Renders Badge components with count, active state highlighting, clear link. |
| `src/features/applications/components/tag-editor.tsx` | Client island for tag editing | VERIFIED | 48 lines. Wraps TagInput with useActionState + updateTagsAction. Hidden JSON field for form submission. |
| `src/app/api/applications/filter/route.ts` | Tag filter API endpoint | VERIFIED | 36 lines. GET endpoint, auth check, delegates to findApplicationsByTag. |
| `src/core/queries/search.ts` | Full-text search function | VERIFIED (partial) | 144 lines. Searches applications/emails/stages but NOT company names or tags. |
| `src/app/search/page.tsx` | Search results page | VERIFIED (partial) | 175 lines. Grouped results, empty state, error handling. Missing: text highlighting. |
| `src/features/search/components/search-bar.tsx` | Search bar with shortcut | VERIFIED (orphaned) | 34 lines. Integrates useSearchShortcut, form submit navigates to /search. NOT wired into app shell. |
| `src/features/search/hooks/use-search-shortcut.ts` | Global / shortcut hook | VERIFIED | 32 lines. useEffect + keydown listener, skips text inputs and contentEditable. |
| `src/core/queries/search.test.ts` | Search integration tests | VERIFIED | 159 lines, 7 tests covering search, isolation, performance. |
| `src/features/search/components/search-bar.test.tsx` | Search bar tests | VERIFIED | 77 lines, 6 tests covering shortcut focus, submit navigation. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| TagEditor | updateTagsAction | useActionState + form action | WIRED | TagEditor binds action, passes tags as hidden JSON field |
| TagCloud | /applications?tag=... | Link href | WIRED | Each badge links to filtered URL, active state links to /applications |
| /api/applications/filter | findApplicationsByTag | Import + call | WIRED | Route imports and delegates to service function |
| applications/page.tsx | TagCloud | Import + render | WIRED | TagCloud rendered with tags from findAllTags |
| applications/page.tsx | findApplicationsForList | tag option | WIRED | Query accepts tag filter, applies `has` clause |
| application-detail.tsx | TagEditor | Import + render | WIRED | TagEditor rendered with application.tags and allTags |
| SearchBar | useSearchShortcut | Import + call | WIRED | Hook called with inputRef |
| SearchBar | /search?q=... | router.push | WIRED | Form submit navigates to search page |
| search/page.tsx | fullTextSearch | Import + call | WIRED | Server component calls fullTextSearch with userId and query |
| AppShell | SearchBar | NOT WIRED | ORPHANED | SearchBar exists but is not imported in app-shell.tsx or nav-links.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| TagCloud | tags (TagWithCount[]) | findAllTags via withRls | Yes — aggregates from application.tags | FLOWING |
| TagEditor | initialTags, allTags | application.tags + findAllTags | Yes — real DB data | FLOWING |
| /api/applications/filter | filtered apps | findApplicationsByTag via Prisma `has` | Yes — real DB query | FLOWING |
| search/page.tsx | results | fullTextSearch via withRls | Yes — parallel queries across 3 entity types | FLOWING |
| search/page.tsx | results.applications[].companyName | company.name via Prisma include | Yes — joined from Company table | FLOWING |
| search.ts | searchText field | Never populated | No — always NULL | HOLLOW |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tags service exports expected functions | `grep -c "export async function" src/features/applications/tags-service.ts` | 4 (findAllTags, addTag, removeTag, findApplicationsByTag) | PASS |
| Search function exports | `grep -c "export async function" src/core/queries/search.ts` | 1 (fullTextSearch) | PASS |
| Search page is a valid route | `ls src/app/search/page.tsx` | Exists | PASS |
| Filter API is a valid route | `ls src/app/api/applications/filter/route.ts` | Exists | PASS |
| TagInput has keyboard handlers | `grep -c "handleKeyDown\|onKeyDown" src/features/applications/components/tag-input.tsx` | 2 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TAG-01 | 08-01 | Add/remove tags on applications (UI + API) | SATISFIED | TagEditor + TagInput + updateTagsAction + tags-service CRUD |
| TAG-02 | 08-01 | Autocomplete suggests existing tags | SATISFIED | TagInput filters allTags on input change, keyboard navigable dropdown |
| TAG-03 | 08-02 | Filter applications by tag | SATISFIED | TagCloud + filter API + URL param filtering in applications page |
| SRCH-01 | 08-02 | Full-text search across all 5 sources | BLOCKED | Only 3 sources searched (roleTitle/notes/searchText, subject/bodyExcerpt, stage name). Company.name and tags missing. |
| SRCH-02 | 08-03 | Search results grouped by entity type | SATISFIED | /search page renders Applications, Emails, Stages in separate sections |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/core/queries/search.ts | 72 | searchText queried but never populated | Warning | Dead code path — searchText always NULL, GIN index unused |
| src/features/search/components/search-bar.tsx | - | Component not wired into app shell | Warning | SearchBar is orphaned — users must navigate to /search manually |

### Human Verification Required

### 1. Tag add/remove inline behavior

**Test:** Open an application detail page, add a tag via the tag input, remove a tag via the X button.
**Expected:** Tags update inline without page reload; new tag appears as removable badge.
**Why human:** Server action behavior and inline React state update require browser interaction.

### 2. Tag cloud filtering

**Test:** On /applications page, click a tag in the tag cloud. Verify list filters. Click "Clear" to reset.
**Expected:** Only applications with that tag shown. Clear link removes filter.
**Why human:** URL param routing and list re-render require browser navigation.

### 3. Search results display

**Test:** Navigate to /search?q=engineer, verify grouped results across entity types.
**Expected:** Applications, Emails, Stages shown in separate sections with counts.
**Why human:** Full-text search results depend on live database content.

### 4. Keyboard shortcut

**Test:** On any page, press / key. Verify search input receives focus.
**Expected:** Search input focused; typing in a text field does not trigger shortcut.
**Why human:** Keyboard event handling requires browser interaction.

### Gaps Summary

Three of five success criteria are not met:

1. **Search scope is incomplete (SC3):** The fullTextSearch function searches roleTitle, notes, and searchText on applications; subject and bodyExcerpt on emails; and name on stages. It does NOT search Company.name (no company table join) and does NOT search Application.tags. The denormalized searchText column exists in the schema and has a GIN index, but is never populated — making it dead code.

2. **No search result highlighting (SC4):** The /search page renders results as plain text. There is no HighlightText component, no <mark> tags, and no mechanism to emphasize matched substrings. This is entirely unimplemented.

3. **No tag management in settings (SC5):** The /settings page contains Gmail, Bookmarklet, and Language sections only. There is no tag management UI — no rename, delete, or merge functionality. No backend service functions for these operations exist.

Additionally, the SearchBar component (with keyboard shortcut integration) is orphaned — it exists and is tested but is not imported into the app shell or navigation. Users can only access search by navigating directly to /search.

---

_Verified: 2026-05-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
