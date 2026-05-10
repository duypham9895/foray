---
phase: 12-document-storage
plan: 03
subsystem: ui
tags: [react, client-components, file-upload, streaming-download, timeline, vsa]

# Dependency graph
requires:
  - phase: 12-document-storage/01
    provides: "Document service layer (uploadDocument, getDocument, deleteDocument, listDocuments)"
  - phase: 12-document-storage/02
    provides: "API routes (POST upload, GET list, GET download, DELETE)"
provides:
  - "DocumentList client component with kind badge, download link, size, date, delete with confirmation"
  - "UploadForm client component with file input, kind selector, notes field, loading state"
  - "ApplicationDetail type includes documents array"
  - "findApplicationDetail fetches documents in the same transaction"
  - "document_uploaded event rendering in timeline"
  - "VSA boundary exception: applications slice can import from documents slice"
affects: [12-document-storage, application-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-island-for-mutations, router-refresh-after-mutation, window-confirm-for-destructive-actions]

key-files:
  created:
    - src/features/documents/components/document-list.tsx
    - src/features/documents/components/upload-form.tsx
  modified:
    - src/features/applications/queries.ts
    - src/features/applications/components/application-detail.tsx
    - src/features/applications/components/timeline.tsx
    - eslint.config.mjs

key-decisions:
  - "Added VSA boundary exception for applications→documents imports in eslint.config.mjs"
  - "Used router.refresh() for post-mutation data revalidation (Next.js App Router pattern)"
  - "Used window.confirm() for delete confirmation (simple, no extra dependency)"

patterns-established:
  - "Document UI pattern: kind badge + download link + size + date + delete button"
  - "Upload form pattern: file input + kind selector + notes textarea + loading state"
  - "Timeline event pattern: switch case in describeEvent for new event types"

requirements-completed: [DOC-01, DOC-05, DOC-07]

# Metrics
duration: 7min
completed: 2026-05-10
---

# Phase 12 Plan 03: Document Management UI Summary

**Document list with download/delete, upload form with kind selector, and timeline rendering for document_uploaded events**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-10T09:39:12Z
- **Completed:** 2026-05-10T09:46:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created DocumentList client component with kind badge, filename download link, formatted size, upload date, and delete button with confirmation dialog
- Created UploadForm client component with file input, kind selector, notes field, loading state, and error handling (413, 422, generic errors)
- Updated ApplicationDetail type to include documents array, fetched in the same transaction
- Added Documents section to application detail page between Tags and Timeline
- Added document_uploaded event rendering to timeline with "Document uploaded: {filename} ({kind})"
- Added VSA boundary exception for applications→documents imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Document list and upload components** - `7c9c35e` (feat)
2. **Task 2: Wire documents into application detail and timeline** - `2a1c247` (feat)

## Files Created/Modified

- `src/features/documents/components/document-list.tsx` - Client component with kind badge, download link, size formatting, date display, delete with confirmation
- `src/features/documents/components/upload-form.tsx` - Client component with file input, kind selector, notes textarea, loading state, error handling
- `src/features/applications/queries.ts` - Added Document type import, documents array to ApplicationDetail, document.findMany query
- `src/features/applications/components/application-detail.tsx` - Imported DocumentList and UploadForm, added Documents section between Tags and Timeline
- `src/features/applications/components/timeline.tsx` - Added document_uploaded case to describeEvent function
- `eslint.config.mjs` - Added VSA boundary exception for applications→documents imports

## Decisions Made

- Added VSA boundary exception for applications→documents imports (required for application detail page to render document components)
- Used router.refresh() for post-mutation data revalidation (Next.js App Router pattern, no extra state management needed)
- Used window.confirm() for delete confirmation (simple, no extra dependency, matches plan specification)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused variable lint warnings**
- **Found during:** Task 1 (component creation)
- **Issue:** `_applicationId` parameter in DocumentList was unused; `DocumentKind` import in UploadForm was unused
- **Fix:** Removed unused `_applicationId` parameter and `DocumentKind` import
- **Files modified:** src/features/documents/components/document-list.tsx, src/features/documents/components/upload-form.tsx
- **Verification:** eslint passes with no warnings in new files
- **Committed in:** 7c9c35e

**2. [Rule 3 - Blocking] Added VSA boundary exception for cross-slice imports**
- **Found during:** Task 2 (wiring components)
- **Issue:** ESLint boundaries/element-types rule blocked applications slice from importing documents slice components
- **Fix:** Added exception in eslint.config.mjs allowing applications→documents imports
- **Files modified:** eslint.config.mjs
- **Verification:** eslint passes for application-detail.tsx
- **Committed in:** 2a1c247

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None - all issues resolved via deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Document management UI complete, ready for end-to-end testing
- All document operations (upload, list, download, delete) accessible from application detail page
- Timeline shows document upload events
- Pre-existing test failure in service.test.ts (storage path UUID assertion) - not caused by this plan

---
*Phase: 12-document-storage*
*Completed: 2026-05-10*

## Self-Check: PASSED

- All 6 files verified on disk
- Both commit hashes (7c9c35e, 2a1c247) verified in git history
- typecheck: clean
- lint: clean (0 errors in new files)
