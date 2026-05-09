# Research: Phase 8 - Tags + Search

**Phase**: Standard-3  
**Goal**: Enable user-defined tagging and full-text search across all application data  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Users cannot organize applications beyond the canonical status (applied, screening, etc.) and cannot find applications except by scrolling.

**Friction points**:
- "I want to filter by company type" (e.g., fintech, climate) — no way to do it
- "I want to find all applications I starred" — no starred applications feature
- "Show me all positions requiring React" — must manually scan applications
- Search across applications is keyword-only, doesn't search emails

**Solution**:
- User-defined tags (add/remove tags on applications)
- Tag filtering (`/applications?tag=fintech`)
- Full-text search across applications + emails
- Quick tag cloud showing most-used tags

---

## Tag Schema Design

**Option A: Array field (Postgres)**
```sql
applications.tags = '["fintech", "remote", "startup"]'
-- Pros: Simple, JSON native, fast equality
-- Cons: No count aggregation, can't index individual tags
```

**Option B: Junction table**
```sql
CREATE TABLE application_tags (
  id INT PRIMARY KEY,
  application_id INT REFERENCES applications,
  tag_id INT REFERENCES tags,
  UNIQUE(application_id, tag_id)
);
-- Pros: Normalizes tag data, fast aggregation, easy to count
-- Cons: Requires JOIN, slightly more complex queries
```

**Decision**: Use **array field** for Phase 8 (simpler schema, fewer migrations).
- Prisma: `tags String[]` in schema.prisma
- Store as JSON in Postgres: `tags: Json`
- Query: `WHERE tags.contains("fintech")`

If performance becomes a problem later (>10k applications), migrate to junction table.

---

## Full-Text Search Architecture

**Scope**: Search across 5 data sources simultaneously:
1. Application role title
2. Company name
3. Application notes
4. Stage names (e.g., "final round", "take-home assignment")
5. Email subjects + body excerpts

**Search targets**:
```
SELECT applications.*, emails.* WHERE 
  applications.roleTitle ~* $1 OR
  companies.name ~* $1 OR
  applications.notes ~* $1 OR
  stages.name ~* $1 OR
  emails.subject ~* $1 OR
  emails.bodyExcerpt ~* $1
```

**Performance target**: <300ms for typical query on 50+ applications, 200+ emails

**Indexing strategy**:
```sql
CREATE INDEX idx_apps_roletitle_fulltext ON applications USING gin(to_tsvector('english', roleTitle));
CREATE INDEX idx_company_name_fulltext ON companies USING gin(to_tsvector('english', name));
CREATE INDEX idx_email_subject_fulltext ON emails USING gin(to_tsvector('english', subject));
```

---

## Search Result Grouping

Results are grouped by entity type:
- **Applications** (matching role, company, notes, or stages)
- **Emails** (matching subject or body excerpt)

Each group shows count: "3 applications match", "5 emails match"

Click on application → application detail view  
Click on email → application detail view with email highlighted

---

## Tag Input Component Design

**UI Flow**:
1. Tag input field with autocomplete
2. Type letters → autocomplete shows existing tags starting with those letters
3. Press Enter or select from dropdown → add tag
4. Tags display as removable badges
5. Click X → remove tag

**Keyboard handling**:
- Arrow up/down → navigate dropdown
- Enter → select highlighted option
- Escape → close dropdown
- Backspace (on empty input) → remove last tag

---

## Prisma Full-Text Patterns

**For Postgres**:
```prisma
model Application {
  id Int @id
  roleTitle String
  notes String
  tags String[]
  // ...
  @@fulltext([roleTitle, notes])
}

// Query: applications.findMany({
//   where: {
//     OR: [
//       { roleTitle: { search: "react typescript" } },
//       { notes: { search: "react typescript" } }
//     ]
//   }
// })
```

**For Email**:
```prisma
model Email {
  subject String
  bodyExcerpt String
  @@fulltext([subject, bodyExcerpt])
}
```

---

## Performance Targets

| Operation | Target | Assumption |
|-----------|--------|-----------|
| Tag filter (show all fintech) | <50ms | Index on tags |
| Full-text search (all 5 sources) | <300ms | GIN indexes + parallel queries |
| Autocomplete dropdown | <100ms | In-memory distinct tag list |
| Tag cloud render | <30ms | Pre-aggregated top 20 tags |

---

## API Endpoints

- `GET /api/applications/search?q=react` → Full-text search across all sources
- `GET /api/applications?tag=fintech` → Filter by tag
- `GET /api/tags` → List all tags with counts
- `POST /api/applications/:id/tags` → Add tag to application
- `DELETE /api/applications/:id/tags/:tagId` → Remove tag from application

---

## Keyboard Shortcut Integration

Phase 4 adds a `/` keyboard shortcut that focuses the search box. Phase 8 search bar must respond to that.

---

*Phase 8 unlocks organization and discoverability. No major architectural changes — simple schema additions + smart queries.*
