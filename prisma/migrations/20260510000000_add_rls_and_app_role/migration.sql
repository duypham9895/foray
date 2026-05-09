-- Migration: add_rls_and_app_role
-- Phase 1 — FND-02: multi-tenant safety net via Postgres RLS
-- Read-first: .planning/phases/01-foundation-auth/01-RESEARCH.md §1

-- =============================================================================
-- 1. Non-superuser application role
-- =============================================================================
-- Created idempotently so re-applying the migration on a fresh DB is safe.
-- Password sourced from a separate secret in production; for local dev the
-- DATABASE_URL connection string carries it. Never commit the real password.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'foray_app') THEN
    CREATE ROLE foray_app LOGIN PASSWORD 'CHANGE_ME_VIA_ENV';
  END IF;
END$$;

-- Minimum grants: USAGE on schema, CRUD on tables, USAGE/SELECT on sequences.
-- foray_app does NOT own the tables and is NOT a superuser, so RLS will fire.
GRANT USAGE ON SCHEMA public TO foray_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO foray_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO foray_app;

-- Future tables created by future migrations also need grants. Set the default:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO foray_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO foray_app;

-- =============================================================================
-- 2. Enable + FORCE row-level security on every tenant-scoped table
-- =============================================================================
-- ENABLE alone is insufficient: the table owner bypasses policies. FORCE makes
-- the policy apply even to the owner — closes the Pitfall #2 hole.

ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   FORCE  ROW LEVEL SECURITY;

ALTER TABLE companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies               FORCE  ROW LEVEL SECURITY;

ALTER TABLE applications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications            FORCE  ROW LEVEL SECURITY;

ALTER TABLE stages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE emails                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE recruiters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters              FORCE  ROW LEVEL SECURITY;

ALTER TABLE application_recruiters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_recruiters  FORCE  ROW LEVEL SECURITY;

ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Tenant isolation policies
-- =============================================================================
-- Pattern: USING + WITH CHECK both reference current_setting('app.user_id', true).
-- The `, true` arg means "return NULL if unset" rather than throwing — combined
-- with the ::int cast and the equality check, NULL → policy denies (no row
-- matches `user_id = NULL`). This is the safe default.

-- User table: id = …, NOT user_id = … (User has no user_id column; its id IS the user)
CREATE POLICY tenant_isolation ON users
  USING       (id = current_setting('app.user_id', true)::int)
  WITH CHECK  (id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON companies
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON applications
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON events
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON emails
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON recruiters
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

-- Stages: scope through Application (no direct user_id column)
CREATE POLICY tenant_isolation ON stages
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));

-- ApplicationRecruiters: same parent-scope pattern (no direct user_id column)
CREATE POLICY tenant_isolation ON application_recruiters
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));

-- Documents: same parent-scope pattern (no direct user_id column)
CREATE POLICY tenant_isolation ON documents
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));
