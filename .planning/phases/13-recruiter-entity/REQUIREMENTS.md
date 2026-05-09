# Requirements: Phase 13 - Recruiter Entity

**Phase**: Full-3  
**Derived from**: FULL-ROADMAP.md Phase 3  
**Maps to**: Plans 13-01, 13-02, 13-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| REC-01 | Recruiter model created (email, name, phone, LinkedIn) | 13-01 | Prisma schema + migration applied |
| REC-02 | Auto-extract recruiter from email (sender address + headers) | 13-01 | Email arrives → Recruiter record created with name extracted |
| REC-03 | Link recruiter to application (many-to-many) | 13-02 | Email from recruiter → ApplicationRecruiter created |
| REC-04 | Recruiter list page (`/recruiters`) shows all recruiters | 13-02 | Page renders list, sorted by lastContact |
| REC-05 | Recruiter detail page shows all applications + email history | 13-03 | `/recruiters/:id` shows linked applications + emails |
| REC-06 | Merge duplicate recruiters (combine email addresses) | 13-03 | POST merge → records updated to consolidated recruiter |
| REC-07 | Deduplication UI shows possible duplicates | 13-02 | Page suggests "John Smith (3 records)" as duplicate |
| REC-08 | User can edit recruiter metadata (name, phone, LinkedIn, notes) | 13-03 | Click edit → form updates recruiter record |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Data Integrity | No duplicate recruiter records per email | Unique constraint on (userId, email) |
| Performance | Recruiter list load time | <200ms for 100+ recruiters |
| Performance | Recruiter detail load time | <300ms including applications + email history |
| Privacy | Recruiter PII encrypted | email, phone, LinkedIn encrypted in DB |
| Privacy | Recruiter data not logged | Never included in classifier logs |
| Usability | Auto-extraction accuracy | >80% names extracted correctly |

---

## Boundary Conditions

- **Email extraction**: Regex patterns for phone (`+1-xxx-xxx-xxxx`, `(xxx) xxx-xxxx`)
- **Company extraction**: From signature lines (heuristic-based, not perfect)
- **Deduplication**: User-driven (not automatic), with manual merge UI
- **Data retention**: Soft-deleted recruiters can be permanently deleted after 90 days

---

## Success Criteria

- [ ] Recruiter Prisma model created + migration
- [ ] Auto-extraction from Email.from + signatures working
- [ ] ApplicationRecruiter junction table linking works
- [ ] `/recruiters` page lists all recruiters + filters
- [ ] `/recruiters/:id` detail page shows applications + emails
- [ ] Merge endpoint combines recruiter records correctly
- [ ] Deduplication UI shows possible matches
- [ ] Edit form updates recruiter fields
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: Applications + emails exist
- **Full-2 optional**: Document storage can enhance recruiter profile
- **Email classification working**: Emails already being processed
- **Postgres encryption**: Use pgcrypto or similar for PII encryption

---

## Out of Scope (Phase 13)

- Automatic deduplication (ML-based) — saved for Full-6
- Recruiter rating system — saved for Full-6
- Bulk recruiter operations (export, delete) — saved for Full-6
- Recruiter communication history (call logs, etc.) — future phase
- Recruiter marketplace / sharing with other users — out of scope

---

## Integration Points

- **Standard-4**: Keyboard shortcut can navigate to recruiters
- **Full-2**: Documents can be attached to recruiter profile
- **Full-4**: Calendar invites can auto-link recruiter
- **Full-5**: Analytics can track recruiter effectiveness

---

## API Endpoints

- `GET /api/recruiters?sort=lastContact` → List recruiters
- `GET /api/recruiters/:id` → Recruiter detail + related data
- `POST /api/recruiters` → Create manually
- `PUT /api/recruiters/:id` → Update metadata
- `POST /api/recruiters/:id1/merge/:id2` → Merge duplicates
- `DELETE /api/recruiters/:id` → Soft-delete
- `GET /api/applications?recruiterId=:id` → Applications from recruiter

---

## Testing Strategy

- Unit tests: Email parsing, name extraction
- Integration tests: Recruiter auto-creation from email
- Security tests: PII encryption, access control
- UI tests: Recruiter list, detail, merge flow
