# Requirements: Phase 10 - E2E Tests + Acceptance

**Phase**: Standard-5  
**Derived from**: STANDARD-ROADMAP.md Phase 5  
**Maps to**: Plans 10-01, 10-02, 10-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| E2E-01 | Playwright configuration + fixtures working | 10-01 | `npm run e2e` runs without errors |
| E2E-02 | Database reset works (clean state before each test) | 10-01 | Truncate tables + create fresh user succeeds |
| E2E-03 | Bookmarklet flow tested E2E (simulate → capture → form) | 10-02 | Test passes on fresh database in Docker |
| E2E-04 | Today dashboard E2E test (<500ms load, all 4 sections) | 10-02 | Dashboard renders 4 sections, load <500ms |
| E2E-05 | Search + tags flow E2E tested (add tag → filter → search) | 10-02 | Tag added, search returns correct results |
| E2E-06 | Keyboard shortcuts E2E tested (`n` opens form, undo works) | 10-02 | Shortcuts fire, undo restores deleted app |
| E2E-07 | Dockerfile.e2e exists + builds without errors | 10-03 | `docker build -f Dockerfile.e2e .` succeeds |
| E2E-08 | GitHub Actions CI workflow exists + runs tests | 10-03 | `.github/workflows/e2e.yml` triggers on push, runs tests |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Dashboard load <500ms | Verified in E2E test with real database |
| Performance | Search latency <300ms | Verified in E2E test |
| Reliability | Tests pass 3 consecutive runs | No flakiness |
| Reliability | E2E tests pass in Docker | Fresh environment, no local state |
| Reliability | CI tests pass on every PR | Automated gate before merge |
| Debuggability | Playwright trace saved on failure | HTML report + screenshots + video |
| Maintainability | Test code uses page fixtures | DRY test setup (no copy-paste) |

---

## Boundary Conditions

- **Test user lifetime**: Unique per test run, cleaned up after
- **Database reset time**: <2 seconds (must be fast for test suite)
- **Docker container resources**: Must run on standard GitHub Actions runner (4GB RAM, 2 CPU)
- **CI timeout**: Tests must complete within 10 minutes (including build + test)
- **Flakiness tolerance**: 0% (all tests must pass deterministically)

---

## Success Criteria

- [ ] `npm run e2e` runs all tests successfully
- [ ] At least 10 E2E specs covering all Standard phases (6-9)
- [ ] Database reset works for clean state
- [ ] User fixtures create authenticated test users
- [ ] Playwright HTML report generated with pass/fail summary
- [ ] Docker image builds + runs E2E tests successfully
- [ ] GitHub Actions workflow file created + enables E2E CI
- [ ] Performance assertions verify <500ms dashboard, <300ms search
- [ ] Test artifacts (screenshots, videos, traces) available on failure
- [ ] All pre-commit checks still pass (lint, typecheck, unit tests, build)

---

## Dependencies

- **Standard-1 through Standard-4 complete**: All features implemented
- **Playwright installed**: `npm install --save-dev @playwright/test`
- **Docker + Docker Compose available**: For reproducible test environment
- **GitHub Actions secrets configured**: Database URL (if needed)
- **postgres:15-alpine image**: Available on Docker Hub

---

## Test Categories

### Phase 6 (Bookmarklet) Tests
- [ ] Simulate bookmarklet execution
- [ ] Verify `/api/capture` called with extracted data
- [ ] Verify redirect to form with prefill params
- [ ] Verify form values populated from params

### Phase 7 (Today Dashboard) Tests
- [ ] Load dashboard, verify 4 sections render
- [ ] Verify page load <500ms
- [ ] Test empty states (no data scenarios)
- [ ] Verify week summary delta calculation

### Phase 8 (Tags + Search) Tests
- [ ] Add tag to application
- [ ] Filter by tag (visible/not visible correctly)
- [ ] Full-text search (all 5 sources)
- [ ] Verify results grouped by entity type
- [ ] Verify search <300ms latency

### Phase 9 (Shortcuts + UX) Tests
- [ ] Keyboard shortcut `n` opens form
- [ ] Keyboard shortcut `/` focuses search
- [ ] Navigation shortcuts (`g+a`, `g+i`, `g+s`)
- [ ] Delete application triggers undo toast
- [ ] Click undo → app restored
- [ ] Timer expires → app permanently deleted

---

## Out of Scope

- Performance testing (load testing, stress testing) — saved for Full phase
- Visual regression testing (screenshot comparison) — saved for Full phase
- Accessibility testing beyond basic keyboard support
- Mobile browser testing (assumed handled by unit tests + manual)
- Test reports integration with GitHub

---

## CI Integration

- **PR status checks**: E2E tests must pass before merge
- **Failure notifications**: CI displays pass/fail in PR
- **Artifacts**: Playwright report available for download
- **Coverage**: No code coverage requirements for E2E (unit tests handle that)

---

## Acceptance Sign-Off Checklist

When Phase 10 is complete, verify:
- [ ] Standard Roadmap completed (phases 6-10)
- [ ] All E2E tests passing in Docker CI
- [ ] Performance targets verified (<500ms dashboard, <300ms search)
- [ ] Manual user journey test (walkthrough all features)
- [ ] No open bugs / all issues resolved
- [ ] Documentation updated (README, ROADMAP, memory files)
- [ ] Ready to transition to Full milestone
