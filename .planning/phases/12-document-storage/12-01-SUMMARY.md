---
phase: 12-document-storage
plan: 01
subsystem: documents
tags: [prisma, zod, file-upload, magic-bytes, mime-detection, path-traversal]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Prisma schema, withRls, branded ID types, AppError taxonomy"
  - phase: 02-applications
    provides: "Application model, Event system, eventDataSchemas"
provides:
  - "Document model (version field removed)"
  - "Strict document_uploaded event data schema"
  - "Document Zod schema with magic-byte MIME validation"
  - "Service layer: uploadDocument, deleteDocument, listDocuments, getDocument"
  - "Path-traversal-safe filename sanitization"
  - "10MB file size limit enforcement"
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [magic-byte-mime-detection, throw-bridge-translator, path-traversal-sanitization]

key-files:
  created:
    - src/features/documents/schema.ts
    - src/features/documents/service.ts
    - src/features/documents/service.test.ts
  modified:
    - prisma/schema.prisma
    - src/features/applications/schema.ts

key-decisions:
  - "Used throw-bridge pattern matching applications/service.ts for error translation"
  - "Added '..' sequence collapsing to sanitizeFilename for defense-in-depth path traversal prevention"

patterns-established:
  - "Magic-byte MIME detection: check first 8 bytes against ALLOWED_MIME_TYPES, text/plain as fallback"
  - "Document storage path: data/documents/{applicationId}/{docId}/{sanitized-filename}"

requirements-completed: [DOC-01, DOC-02, DOC-06, DOC-07]

# Metrics
duration: 16min
completed: 2026-05-10
---

# Phase 12 Plan 01: Document Schema + Service Layer Summary

**Document model with magic-byte MIME validation, 10MB limit, path-traversal-safe storage, and atomic upload+event creation via withRls transactions**

## Performance

- **Duration:** 16 min
- **Started:** 2026-05-10T08:37:16Z
- **Completed:** 2026-05-10T08:53:23Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Removed deferred version field from Document model in schema.prisma
- Replaced genericPassthrough with strict documentUploadedData schema for document_uploaded events
- Created document Zod schema with magic-byte MIME allowlist (PDF, DOC, DOCX, PNG, JPEG, plain text)
- Implemented service layer with 4 CRUD functions, all using withRls transactions
- Added path-traversal-safe filename sanitization (collapses `..` sequences, replaces special chars)
- 25 unit tests covering detectMimeType, sanitizeFilename, upload, delete, list, get operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Document schema, service layer, and unit tests** - `4db1562` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `prisma/schema.prisma` - Removed `version Int @default(1)` from Document model
- `src/features/applications/schema.ts` - Added strict documentUploadedData schema, wired to document_uploaded event type
- `src/features/documents/schema.ts` - Document Zod schema with MAX_FILE_SIZE, ALLOWED_MIME_TYPES, uploadSchema, documentKindEnum
- `src/features/documents/service.ts` - Service layer with detectMimeType, sanitizeFilename, uploadDocument, deleteDocument, listDocuments, getDocument, translateThrowBridge
- `src/features/documents/service.test.ts` - 25 unit tests with mocked withRls and fs

## Decisions Made
- Used throw-bridge pattern matching applications/service.ts for error translation inside withRls transactions
- Added `..` sequence collapsing to sanitizeFilename for defense-in-depth path traversal prevention (Rule 2 auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added throw-bridge translator for withRls error propagation**
- **Found during:** Task 1 (service implementation)
- **Issue:** withRls wraps thrown errors as errors.db(cause), but the service throws NOT_FOUND:... which needs translation back to NotFound AppError
- **Fix:** Added translateThrowBridge helper matching the pattern in applications/service.ts
- **Files modified:** src/features/documents/service.ts
- **Verification:** All 10 not-found test cases pass with correct error._tag === 'NotFound'
- **Committed in:** 4db1562

**2. [Rule 2 - Security] Added '..' sequence collapsing to sanitizeFilename**
- **Found during:** Task 1 (test execution)
- **Issue:** Path traversal test (../ in filename) produced `.._.._.._etc_passwd` which still contained `..` sequences
- **Fix:** Added `.replace(/\.\./g, '_')` before the general character sanitization
- **Files modified:** src/features/documents/service.ts
- **Verification:** Path traversal test passes, filename contains no `..` sequences
- **Committed in:** 4db1562

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 security)
**Impact on plan:** Both auto-fixes essential for correctness and security. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Document service layer complete, ready for Plan 02 (API routes) and Plan 03 (UI)
- Prisma client regenerated without version field
- All 457 tests passing (36 test files)

---
*Phase: 12-document-storage*
*Completed: 2026-05-10*

## Self-Check: PASSED
- All created files verified present
- Task commit 4db1562 verified in git log
