# Requirements: Phase 8 - Tags + Search

**Phase**: Standard-3  
**Derived from**: STANDARD-ROADMAP.md Phase 3  
**Maps to**: Plans 08-01, 08-02, 08-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| TAG-01 | Add/remove tags on applications (UI + API) | 08-01 | Tag input accepts text, creates tag on Enter, removes on X click |
| TAG-02 | Autocomplete suggests existing tags | 08-01 | Type "fin" → dropdown shows "fintech" and other tags starting with "fin" |
| TAG-03 | Filter applications by tag | 08-02 | `/applications?tag=fintech` returns only fintech-tagged apps |
| SEARCH-01 | Full-text search across all 5 sources | 08-02 | `GET /search?q=react` returns matching apps + emails within <300ms |
| SEARCH-02 | Search results grouped by entity type | 08-03 | Results show "3 applications match", "5 emails match" with separate sections |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Full-text search latency | <300ms on 50 apps, 200 emails |
| Performance | Tag autocomplete | <100ms response |
| Usability | Search keyboard shortcut | `/` key focuses search bar (integrated from Phase 4) |
| Usability | Tag suggestions | Suggest top 20 most-used tags on input focus |
| Reliability | No partial results | Search must return complete result set (not paginated) |
| Data integrity | Tag deduplication | "Fintech" and "fintech" treated as same tag |

---

## Boundary Conditions

- **Tag naming**: Lowercase, alphanumeric + hyphen, max 50 chars
- **Search query**: Min 2 chars, max 100 chars
- **Result limit**: Return ALL matching applications (no pagination), max 1000 emails
- **Tag uniqueness**: Per-application, no duplicate tags
- **Reserved tags**: None (user can use any tag name)

---

## Success Criteria

- [ ] Tag input component with autocomplete exists
- [ ] `/api/applications/:id/tags` POST/DELETE endpoints working
- [ ] `/api/applications?tag=X` filter returns correct results
- [ ] `/api/search?q=X` searches all 5 sources + returns <300ms
- [ ] Search results clearly grouped by entity type
- [ ] Tag cloud (top 20 tags) renders on applications page
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 complete**: Applications exist, can be tagged
- **Standard-2 complete**: Query patterns established
- **Postgres full-text indexing**: GIN indexes on roleTitle, subject, bodyExcerpt
- **No new packages**: Use Prisma built-in full-text support + `tsvector`

---

## Out of Scope

- Tag synonyms (e.g., "fintech" = "financial")
- Hierarchical tags (tags cannot have subtags)
- Private/shared tags (all user tags are private to them)
- Tag suggestions from content (AI-powered tag recommendations saved for Full-5)
- Advanced faceted search (saved for Full-5)

---

## Integration Points

- **Phase 4**: Keyboard shortcut `/` must focus search bar on Phase 8's search component
- **Phase 5**: E2E test coverage for tag + search flows
- **Full-5**: Analytics can track most-used tags for insights
