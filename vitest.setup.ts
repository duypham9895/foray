// Global test setup. Runs before any test module is imported.
// Sets fixture env vars so env.ts passes validation in tests.
// These are test-only values — never used in production.

process.env['DATABASE_URL'] ??= 'postgresql://foray:foray@localhost:5432/foray'
process.env['ENCRYPTION_KEY'] ??= '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
process.env['APP_PASSWORD'] ??= 'test-password-fixture'  // ≥12 chars
process.env['APP_SESSION_SECRET'] ??= 'test-session-secret-fixture-32xx' // exactly 32 chars
