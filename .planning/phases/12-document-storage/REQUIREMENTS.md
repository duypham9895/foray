# Requirements: Phase 12 - Document Storage

**Phase**: Full-2  
**Derived from**: FULL-ROADMAP.md Phase 2  
**Maps to**: Plans 12-01, 12-02, 12-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| DOC-01 | Upload document to application (client validates type + size) | 12-01 | File picker → select PDF → validate locally |
| DOC-02 | Generate signed upload URL | 12-01 | POST `/api/documents/upload-url` returns Supabase signed URL |
| DOC-03 | Virus scan uploaded file (VirusTotal integration) | 12-02 | POST `/api/documents/scan` calls VirusTotal API |
| DOC-04 | Reject infected/suspicious files | 12-02 | Flagged file → save scan result, don't store document |
| DOC-05 | Extract text from PDF for search | 12-02 | PDF uploaded → extractedText populated (async) |
| DOC-06 | Display document list per application | 12-03 | Application detail shows attached documents + download links |
| DOC-07 | Support multiple document types (resume, cover letter, offer) | 12-03 | fileType dropdown allows selection |
| DOC-08 | Delete document (soft-delete, permanent after 30 days) | 12-03 | Click delete → document marked deleted |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Storage | Cloud storage cost | <$1/month for 100 users (Supabase) |
| Security | Virus scanning on all uploads | 100% coverage (no bypass) |
| Security | Signed URLs (no API key exposure) | Time-limited, 1-hour expiry |
| Security | User access control | Can only access own documents |
| Performance | File upload completion | <5 seconds (depending on file size) |
| Performance | Text extraction (async) | Does not block user |
| Usability | File type support | .pdf, .docx, .txt, .jpg, .png |
| Usability | File size limit | Max 10MB per file |
| Compliance | Soft-delete for recovery | 30-day recovery window |

---

## Boundary Conditions

- **File size limit**: Max 10MB per file (prevents abuse)
- **File type whitelist**: Only .pdf, .docx, .txt, .jpg, .png (no executables)
- **Virus scanning**: 100% of files, VirusTotal free tier (4 requests/min)
- **Soft-delete recovery**: 30 days before permanent deletion
- **Storage quota**: No per-user limit (assume responsible usage)

---

## Success Criteria

- [ ] Supabase Storage configured for project
- [ ] Document Prisma model added + migration applied
- [ ] File upload flow works (client validation → signed URL → direct upload)
- [ ] VirusTotal API integration working
- [ ] Text extraction from PDF working (async, doesn't block UI)
- [ ] Document list UI shows all attached documents
- [ ] Delete (soft) and recovery window working
- [ ] File access control verified (users can't access others' files)
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: Applications exist
- **Supabase project setup**: Storage bucket configured
- **VirusTotal API key**: Free tier (4 requests/min) or paid
- **pdfjs-dist library**: `npm install pdfjs-dist` for PDF text extraction
- **Postgres migration**: Add Document table + indexes

---

## Out of Scope (Phase 12)

- Document OCR (optical character recognition) — saved for future
- Automatic resume parser (extract name, phone from resume) — Full-6
- Document version comparison (diff tool) — saved for future
- Collaborative document editing — out of scope
- Bulk document upload — Phase 12 is single-file per action

---

## Integration Points

- **Standard-1**: Extension (Phase 11) can attach documents
- **Full-3**: Recruiter entity can store recruiter documents
- **Full-5**: Analytics can track document trends (which resumes get more interviews)
- **Full-6**: Polish phase can add document management UI enhancements

---

## API Endpoints

- `POST /api/documents/upload-url` → Generate signed Supabase URL
- `POST /api/documents/scan` → Virus scan uploaded file
- `POST /api/documents` → Create Document record
- `GET /api/applications/:id/documents` → List documents for application
- `DELETE /api/documents/:id` → Soft-delete document
- `GET /api/documents/:id/download` → Generate download link (with access check)

---

## Testing Strategy

- Unit tests: File type validation, size validation
- Integration tests: Upload flow, virus scan, text extraction
- Security tests: User access control (can't access others' files)
- Performance tests: Upload speed, text extraction speed
