# Research: Phase 10 - E2E Tests + Acceptance

**Phase**: Standard-5  
**Goal**: End-to-end test coverage for Standard milestone + Docker reproducibility + CI automation  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Phases 6-9 have unit + integration tests, but no full user workflows tested. No Docker reproducibility. No automated CI for Standard.

**Friction points**:
- Cannot verify entire user journey (bookmarklet → capture → today dashboard → undo)
- Tests pass locally but fail in CI (environment differences)
- No proof that Standard works on fresh database
- Manual testing burden for acceptance

**Solution**:
- Playwright E2E tests covering all Standard workflows
- Docker container with fresh database for reproducible tests
- GitHub Actions CI job that runs tests in Docker
- Acceptance checklist for sign-off

---

## Playwright Architecture

**Setup**:
```typescript
// tests/e2e/playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

**Test structure**:
```
tests/e2e/
├── bookmarklet.spec.ts          (capture flow)
├── today-dashboard.spec.ts       (dashboard load)
├── search-tags.spec.ts           (search + filter + tags)
├── keyboard-shortcuts.spec.ts    (shortcuts + undo)
├── fixtures/
│   ├── user-setup.ts            (authenticate, create test user)
│   └── db-reset.ts              (truncate tables between tests)
└── utils/
    ├── assertions.ts            (custom expect helpers)
    └── test-data.ts             (seed realistic data)
```

---

## Database Reset Strategy

**Problem**: Tests need clean database for each test, but spinning up fresh database is slow.

**Solution: Truncate pattern**:
1. Before each test suite: `npm run e2e:reset-db`
2. This runs migration:
   ```sql
   TRUNCATE TABLE emails, applications, stages, reviews CASCADE;
   DELETE FROM users WHERE email LIKE '%@e2e.test';
   ```
3. Tests authenticate as `e2e-{timestamp}@e2e.test` (unique per run)
4. No conflicts between test runs

**Performance**: <2 seconds per reset (fast enough)

---

## Docker Reproducibility

**Dockerfile.e2e**:
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Copy source
COPY . .

# Install + build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Copy docker-compose for services
COPY docker-compose.e2e.yml .

# Expose port 3000 for tests
EXPOSE 3000

# Start server + run tests
CMD pnpm e2e
```

**docker-compose.e2e.yml**:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: foray_e2e
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
    
  server:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:test_password@postgres:5433/foray_e2e
```

**Run**: `docker-compose -f docker-compose.e2e.yml up --abort-on-container-exit`

---

## GitHub Actions CI Workflow

**Trigger**: Every push to `main`, every PR

**.github/workflows/e2e.yml**:
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm lint && pnpm typecheck && pnpm test:run
      - run: docker-compose -f docker-compose.e2e.yml up --abort-on-container-exit
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**On failure**: Artifacts uploaded (screenshots, videos, traces) for debugging

---

## Test Fixtures

**User authentication fixture**:
```typescript
// tests/e2e/fixtures/user-setup.ts
export const authenticatedPage = test.extend({
  page: async ({ page }, use) => {
    // Sign up as unique test user
    await page.goto('/auth/signup');
    const email = `e2e-${Date.now()}@e2e.test`;
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', 'test123');
    await page.click('[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('/');
    
    // Return page to test
    await use(page);
  },
});
```

**DB reset fixture**:
```typescript
export const dbReset = test.extend({
  dbReset: async ({}, use) => {
    await resetDatabase();
    await use();
  },
});
```

---

## Performance Assertions in E2E

**Example**:
```typescript
test('today dashboard loads <500ms', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(500);
});
```

---

## Test Scenarios

**Phase 6 (Bookmarklet)**:
- Simulate bookmarklet click
- Verify `/api/capture` called with correct data
- Verify redirect to `/applications/new?prefilled=...`
- Verify form auto-populates

**Phase 7 (Today Dashboard)**:
- Load dashboard
- Verify 4 sections render
- Verify performance <500ms
- Verify empty states display correctly

**Phase 8 (Search + Tags)**:
- Add tag to application
- Search by tag
- Full-text search
- Verify results grouped by entity

**Phase 9 (Shortcuts + Undo)**:
- Press keyboard shortcut
- Delete application
- Verify undo toast
- Click undo → verify restored

---

## Acceptance Checklist Items

- [ ] All 10+ E2E specs passing in Docker
- [ ] CI workflow runs on every PR
- [ ] Performance targets met (<500ms dashboard, <300ms search)
- [ ] No flaky tests (pass 3 consecutive runs)
- [ ] Playwright HTML report generated + artifacts uploaded on failure
- [ ] Artifacts show screenshots/video of failures
- [ ] Traces capture network + browser logs for debugging

---

*Phase 10 is verification. It proves Standard works end-to-end and is ready for users.*
