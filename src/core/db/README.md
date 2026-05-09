# src/core/db

Two orthogonal helpers, not nested. `tenantDb` filters in app-land; `withRls` filters via RLS. Belt + suspenders.

## `tenantDb` vs `withRls` — when to use which

| Operation | Use | Why |
|---|---|---|
| Single-row read where atomicity isn't required | `tenantDb(userId).application.findUnique(...)` | No transaction overhead. App-layer filter is enough; RLS is the safety net via the policy if the wrapper has a bug. |
| Single-row create with simple shape | `tenantDb(userId).application.create({ data: {...} })` | Wrapper auto-injects `userId` |
| Multi-statement atomic operation (create + write Event, update + write Event) | `withRls(userId, async tx => { ... })` | Transaction guarantees all-or-nothing; `set_config` inside the same transaction guarantees RLS firing on every statement. |
| Anything that uses `$queryRaw` / `$executeRaw` for tenant data | **Always** wrap in `withRls` | Raw SQL bypasses model-level extensions. Only RLS will catch a bug. |
| Background job operating on multiple users (cron) | One `withRls(userId, ...)` per user inside the loop | Each user gets their own transaction + their own `app.user_id`. |

## Key invariants

- `withRls` uses `set_config('app.user_id', userId, true)` — the third arg `true` makes it **transaction-local** (equivalent to `SET LOCAL`). Without it, the value leaks to the next request that reuses the connection from the pool.
- `tenantDb` injects `userId` as a WHERE clause — defense-in-depth so application-layer filtering works even before RLS policies are tuned.
- Never nest `withRls` inside `tenantDb` or vice-versa. They operate at different levels.

## Module exports

```ts
import { prisma } from '@/core/db'     // raw PrismaClient (src/core/db/* only)
import { tenantDb } from '@/core/db'   // app-layer tenant filter
import { withRls } from '@/core/db'    // RLS transaction wrapper
```

Direct `prisma.*` usage outside `src/core/db/` is blocked by the `no-direct-prisma` dependency-cruiser rule.
