-- AlterTable: Add search_text to applications for denormalized full-text search
ALTER TABLE "applications" ADD COLUMN "search_text" TEXT;

-- CreateIndex: GIN indexes for full-text search (PostgreSQL)
-- Applications: search across role_title, notes, search_text
CREATE INDEX "applications_role_title_notes_search_text_gin_idx" ON "applications"
  USING gin(to_tsvector('english', COALESCE("role_title", '') || ' ' || COALESCE("notes", '') || ' ' || COALESCE("search_text", '')));

-- Companies: search across name and domain
CREATE INDEX "companies_name_domain_gin_idx" ON "companies"
  USING gin(to_tsvector('english', COALESCE("name", '') || ' ' || COALESCE("domain", '')));

-- Emails: search across subject and body_excerpt
CREATE INDEX "emails_subject_body_excerpt_gin_idx" ON "emails"
  USING gin(to_tsvector('english', COALESCE("subject", '') || ' ' || COALESCE("body_excerpt", '')));
