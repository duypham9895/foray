---
status: issues_found
phase: 12-document-storage
files_reviewed: 14
depth: standard
reviewed: 2026-05-10
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the document storage slice: Prisma schema, service logic, API routes, React components, Zod schemas, unit tests, and integration tests. The implementation follows VSA architecture, uses `Result<T, AppError>` consistently, enforces tenant safety via `withRls`, validates MIME types via magic bytes, and sanitizes filenames against path traversal. Overall quality is solid.

Found **2 warnings** and **5 info** items. No critical security vulnerabilities.

## Warnings

### WR-01: File written to disk is not cleaned up when DB transaction fails

**File:** `src/features/documents/service.ts`
**Issue:** `uploadDocument` writes the file to disk before entering the `withRls` transaction. If the DB transaction fails, the file remains on disk as an orphan. Over time, repeated failures accumulate wasted disk space with no cleanup mechanism.

**Fix:** Add a try/catch around the `withRls` call that removes the file on transaction failure, or move `fs.writeFile` inside the transaction.

### WR-02: Content-Disposition filename not quoted per RFC 6266

**File:** `src/app/api/documents/[id]/route.ts`
**Issue:** The `Content-Disposition` header lacks RFC 2231 encoding. Low-risk given current sanitization but a correctness issue if sanitization rules change.

## Info

### IN-01: `storagePath` leaked in list API response

**File:** `src/app/api/applications/[id]/documents/route.ts`
**Issue:** `listDocuments` returns full `Document` objects including `storagePath` — the absolute server filesystem path. Add a `select` clause to exclude it.

### IN-02: Missing compound index on Document for list query

**File:** `prisma/schema.prisma`
**Issue:** `@@index([applicationId])` exists but the list query also sorts by `createdAt DESC`. A compound index would be more efficient.

### IN-03: Timeline renders `document_uploaded` events as generic "Event #id"

**File:** `src/features/applications/components/timeline.tsx`
**Issue:** The `describeEvent` switch doesn't handle `document_uploaded`. Should show "Document uploaded: filename (kind)".

### IN-04: Heavy `as any` casts in integration test mocks

**File:** `tests/integration/documents.test.ts`
**Issue:** Extensive `as any` bypasses type checking. Create typed mock helpers for `neverthrow` Results.

### IN-05: Missing edge-case tests for MIME detection and size boundary

**File:** `src/features/documents/service.test.ts`
**Issue:** No test for files smaller than 8 bytes or exactly at 10MB limit.

---

Reviewed: 2026-05-10
Reviewer: Claude (gsd-code-reviewer)
