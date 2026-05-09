import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'node:child_process'

/**
 * Testcontainers globalSetup — boots a disposable Postgres 16 container
 * once per test run (not per file). Called by vitest before any tests run.
 *
 * Sequence:
 * 1. Start container as foray_owner (migration role, NOT foray_app)
 * 2. Apply all migrations as foray_owner (via pnpm prisma migrate deploy)
 * 3. Seed alice (id=1) + bob (id=2) users + two Application rows (one per user)
 * 4. Set foray_app password to a known test value
 * 5. Switch process.env.DATABASE_URL to foray_app (non-superuser, FORCE RLS active)
 * 6. Return teardown function that stops the container
 *
 * Why foray_owner for migration + seed: migrations require DDL privileges.
 * The seed INSERT uses SET row_security = off (only works for the container
 * superuser, which the default foray_owner role is in Testcontainers' postgres:16
 * image) to bypass FORCE RLS during fixture setup.
 *
 * Why foray_app for test run: non-superuser role. FORCE ROW LEVEL SECURITY
 * fires for non-superusers. Tests must connect as foray_app to prove RLS works
 * (Pitfall 9 prevention — connecting as superuser would silently bypass RLS).
 */
export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('foray_test')
    .withUsername('foray_owner')
    .withPassword('test')
    .start()

  const ownerUrl = container.getConnectionUri()

  // Apply all migrations as the owner role.
  // The migration creates the foray_app role with 'CHANGE_ME_VIA_ENV' password.
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: ownerUrl },
    stdio: 'inherit',
  })

  // Seed test fixtures via direct SQL as the owner (superuser in this container).
  // SET row_security = off allows inserts to bypass FORCE RLS during seeding.
  const { Client } = await import('pg')
  const client = new Client({ connectionString: ownerUrl })
  await client.connect()

  // Disable RLS for the seed session (owner is superuser in Testcontainers image).
  await client.query(`SET row_security = off;`)

  // Seed two users: alice = id 1, bob = id 2 (ids assigned by autoincrement).
  await client.query(`
    INSERT INTO users (email, name, created_at, updated_at)
      VALUES ('alice@test', 'Alice', NOW(), NOW()),
             ('bob@test',   'Bob',   NOW(), NOW())
      ON CONFLICT (email) DO NOTHING;
  `)

  // Seed one Application per user so the RLS escape tests have rows to verify.
  await client.query(`
    INSERT INTO applications (user_id, company_id, role_title, applied_at, last_activity_at, created_at, updated_at)
      VALUES (1, NULL, 'Alice Test Role', NOW(), NOW(), NOW(), NOW()),
             (2, NULL, 'Bob Test Role',   NOW(), NOW(), NOW(), NOW())
      ON CONFLICT DO NOTHING;
  `)

  // Set the foray_app password to a known test value so the app connection works.
  await client.query(`ALTER ROLE foray_app PASSWORD 'test_app_pw';`)
  await client.end()

  // Switch the test process to use foray_app (non-superuser) for the rest of the run.
  // All test files connect as foray_app — RLS policies fire correctly.
  const appUrl = ownerUrl.replace('foray_owner:test', 'foray_app:test_app_pw')
  process.env.DATABASE_URL = appUrl

  return async () => {
    await container.stop()
  }
}
