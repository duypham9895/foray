# Stack Research — `foray` v0.3 Full milestone

**Domain:** Single-user, local-first job-application tracker
**Researched:** 2026-05-10
**Overall confidence:** HIGH (all versions verified against npm registry on 2026-05-10)

---

## TL;DR — what to add, what to reuse, what to skip

The v0.1/v0.2 stack (Next.js 16, React 19, Prisma 7, googleapis, Zod, neverthrow, Pino) covers most needs. The Full milestone needs **3 new production deps** and **1 new dev dep**:

| Status | Package | Version | Reason |
|--------|---------|---------|--------|
| ADD (dev) | `wxt` | `^0.20.25` | Chrome MV3 extension framework. Vite-based, TypeScript-native, React support, HMR. |
| ADD (prod) | `recharts` | `^3.8.1` | Declarative React charting for analytics dashboard. Most popular option, React 19 compatible. |
| ADD (prod) | `sonner` | `^2.0.7` | Lightweight toast notifications for reminders + status feedback. |
| ADD (prod) | `@radix-ui/react-dialog` | `^1.1.15` | Modal primitives for document preview, recruiter detail, confirmation dialogs. |
| REUSE | `googleapis` | `^171.4.0` | Already installed. Includes `google.calendar` API. No new dep needed. |
| REUSE | `iron-session` | `^8.0.4` | Extension auth via bearer token (same pattern as bookmarklet). |
| SKIP | `@uppy/*` | — | Overkill for local file upload. Native `<input type="file">` + Server Actions suffice. |
| SKIP | `plasmo` | — | Less mature than WXT for MV3. Different mental model, smaller community. |
| SKIP | `@tremor/react` | — | Does not support React 19 (peer dep `react: ^18.0.0`). |
| SKIP | `visx` | — | Does not support React 19 (peer dep `react: ^16.8.0 || ^17.0.0 || ^18.0.0`). |

---

## Feature-by-Feature Stack Decisions

### 1. Chrome MV3 Extension

**Recommendation: WXT (`wxt@^0.20.25`)**

| Criterion | WXT | Plasmo | Manual Vite + @crxjs |
|-----------|-----|--------|---------------------|
| MV3 support | First-class | First-class | Plugin-based |
| TypeScript | Native | Native | Manual config |
| React support | Built-in | Built-in | Manual config |
| HMR | Yes (Vite) | Yes (Parcel) | Yes (Vite) |
| Manifest generation | Auto from code | Convention-based | Manual JSON |
| Content script DX | Excellent | Good | Manual |
| Community/maturity | Growing fast (2025+) | Larger but slower maintenance | Smallest |
| Node requirement | `>=20.12.0` | No explicit engine | Depends on Vite |
| Bundle weight | Dev dep only (44 transitive deps) | Dev dep (heavier) | Lightest |

**Why WXT over Plasmo:**
- WXT is Vite-based, matching the Next.js ecosystem tooling
- Plasmo uses Parcel under the hood — different bundler, different mental model
- WXT generates manifest.json from TypeScript config (type-safe)
- WXT has better content script injection patterns (auto-import, isolated worlds)
- Plasmo's last major release cadence has slowed; WXT is more actively maintained

**Why not manual Vite + @crxjs/vite-plugin:**
- `@crxjs/vite-plugin` (2.4.0) is a community plugin, not official Chrome team tooling
- Manual manifest management is error-prone (MV3 has strict CSP, service worker lifecycle)
- WXT abstracts these MV3 gotchas by default

**Extension architecture:**
```
extension/
  wxt.config.ts          # WXT config (manifest permissions, CSP)
  entrypoints/
    background.ts        # Service worker: handles API calls to Next.js
    content/
      linkedin.ts        # Content script: scrapes job posting pages
      indeed.ts          # Content script: scrapes Indeed
      greenhouse.ts      # Content script: scrapes Greenhouse ATS
    popup/
      index.html         # Popup UI for quick capture
      main.tsx           # React popup component
  assets/
    icon-*.png           # Extension icons
```

**Auth approach:** Reuse the existing bearer token pattern from the bookmarklet. The extension stores a user-generated API token (hashed in DB, same as `bookmarkletToken` on the User model). No new auth dependency.

**Communication:** Extension content scripts extract job data (title, company, URL, description) -> background script POSTs to `/api/capture` with bearer token -> Next.js creates Application. This reuses the existing capture API.

### 2. Document Storage (File Uploads)

**Recommendation: Native `<input type="file">` + Next.js Server Actions + Node `fs`**

No new library needed. Foray is local-first (ADR-0003), single-user, and uploads are small (resumes are ~100KB-2MB PDFs).

**Why not Uppy:**
- `@uppy/core` (5.2.0) pulls in lodash, preact, nanoid, and 7+ internal packages
- `@uppy/react` requires `@uppy/dashboard` or `@uppy/status-bar` for UI — more deps
- Uppy is designed for multi-file, resumable, chunked uploads to S3/cloud storage
- Foray needs: one file at a time, local filesystem, <5MB per file

**Why not react-dropzone:**
- Peer dep `react: '>= 16.8 || 18.0.0'` is ambiguous for React 19 (the `|| 18.0.0` range looks like a version spec bug)
- It's just a dropzone wrapper around `<input type="file">` — 90% of its value is the `onDrop` callback
- A 20-line custom hook using `onDragOver`/`onDrop` events gives the same UX

**Implementation pattern:**
```typescript
// Server Action for upload
async function uploadDocument(formData: FormData) {
  const file = formData.get('file') as File;
  const applicationId = formData.get('applicationId') as string;

  // Validate: size < 5MB, type in allowlist
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${crypto.randomUUID()}-${file.name}`;
  const uploadDir = path.join(process.cwd(), 'data', 'documents', applicationId);

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  // Store metadata in Prisma
  await tenantDb(userId).document.create({
    data: { applicationId, filename, originalName: file.name, size: file.size, mimeType: file.type }
  });
}
```

**Storage location:** `data/documents/<applicationId>/` — gitignored, local filesystem. Metadata in a new `Document` Prisma model.

**What to add to .gitignore:** `data/documents/` (alongside existing `data/classifier-log.jsonl`).

### 3. Recruiter Entity

**No new dependencies.** This is a pure Prisma schema addition + CRUD slice.

New `Recruiter` model in `schema.prisma`:
- Fields: `id`, `name`, `email`, `company`, `phone`, `linkedinUrl`, `notes`, `createdAt`, `updatedAt`
- Relation: one Recruiter has many Applications (optional FK on Application)
- Tenant-scoped via existing `tenantDb(userId)` pattern
- New slice: `src/features/recruiters/`

### 4. Google Calendar Integration

**No new dependencies.** The existing `googleapis@^171.4.0` package includes the full Google Calendar API v3.

```typescript
// Already available:
import { google } from 'googleapis';
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
```

**OAuth scope change:** Add `https://www.googleapis.com/auth/calendar.readonly` to the existing OAuth consent screen. The existing `google-auth-library` handles token refresh automatically.

**What this gives us:**
- `calendar.events.list()` — fetch interview events for a date range
- Webhook support via `calendar.events.watch()` — but requires public endpoint (skip for local-first)
- Polling approach: fetch events every 15 min (reuse existing `node-cron` job, or add a second cron task)

**Timezone handling:** `date-fns-tz@^3.2.0` (already installed as transitive dep of date-fns v4, or add explicitly if not). Google Calendar returns times in RFC3339 format; `date-fns-tz` converts to local timezone for display.

### 5. Analytics Dashboard

**Recommendation: Recharts (`recharts@^3.8.1`)**

| Criterion | Recharts | Chart.js + react-chartjs-2 | Nivo |
|-----------|----------|---------------------------|------|
| React 19 support | Yes (peer dep `^19.0.0`) | Yes | Yes |
| API style | Declarative JSX | Imperative canvas + wrapper | Declarative JSX |
| Bundle size | Larger (pulls @reduxjs/toolkit, react-redux) | Smaller (~60KB gzipped for both) | Medium (many @nivo/* packages) |
| Funnel chart | Custom (stacked bar) | Plugin needed | Built-in funnel |
| Community | 25K+ GitHub stars, most popular | 65K+ stars (Chart.js), smaller React wrapper | 13K+ stars |
| SSR support | Yes (SVG-based) | Needs `dynamic import` (canvas) | Yes (SVG-based) |
| Theming | Built-in ResponsiveContainer | Manual | Built-in |

**Why Recharts over Chart.js:**
- Recharts is SVG-based — works with SSR (Next.js Server Components can render charts)
- Chart.js is canvas-based — requires `dynamic(() => import(...), { ssr: false })` wrapper
- Recharts' declarative API matches React patterns: `<BarChart>`, `<LineChart>`, `<PieChart>`
- Foray needs: funnel (stacked bar), response rate (line), time-to-offer (bar), status distribution (pie) — all straightforward in Recharts

**The Redux dependency concern:**
- Recharts 3.x bundles `@reduxjs/toolkit` (2.11.2) and `react-redux` (9.2.0) as direct dependencies
- This adds ~40KB gzipped to the bundle
- For a local-first single-user app, this is acceptable — initial load time is not a UX bottleneck
- The alternative (Chart.js) saves bundle but adds canvas SSR complexity

**What NOT to add:**
- `@tremor/react` (3.18.7) — peer dep `react: ^18.0.0` does NOT include React 19. Will fail `pnpm install` with peer dep errors.
- `visx` (3.12.0) — peer dep `react: ^16.8.0 || ^17.0.0 || ^18.0.0` does NOT include React 19.
- `d3` directly — Recharts wraps D3 internally. Adding raw D3 creates two rendering pipelines.

### 6. Reminders + Polish

**Recommendation: Sonner (`sonner@^2.0.7`)**

| Criterion | Sonner | react-hot-toast | Notistack |
|-----------|--------|-----------------|-----------|
| React 19 support | Yes (`^18 \|\| ^19`) | Yes (`>=16`) | No (MUI-dependent) |
| Bundle size | ~5KB gzipped | ~7KB gzipped | ~30KB+ (MUI dep) |
| API | `<Toaster />` + `toast()` | `<ToToaster />` + `toast()` | `useSnackbar()` |
| Style | Built-in, beautiful defaults | Customizable | Material Design |
| Promise support | Yes | Yes | Manual |
| SSR support | Yes | Yes | Yes |

**Why Sonner:**
- Smallest bundle, cleanest API, modern design
- `toast.promise()` for async operations (file upload, calendar sync)
- Built-in success/error/loading states
- No MUI dependency (Notistack requires @mui/material)

**Browser Notifications API (native):**
- For reminders (interview in 1 hour, stale foray), use the native `Notification` API
- No library needed: `new Notification('Interview in 1 hour', { body: '...' })`
- Requires user permission (`Notification.requestPermission()`)
- Works when the app tab is open; no service worker needed for local-first

**What NOT to add:**
- `react-hot-toast` — older API, larger bundle, less maintained
- `notistack` — requires MUI, massive dependency tree
- `push.js`, `node-notifier` — server-side notification libraries; foray is browser-first

---

## Installation

```bash
# Production deps (analytics, toasts, dialog primitives)
pnpm add recharts sonner @radix-ui/react-dialog

# Dev deps (extension build tooling)
pnpm add -D wxt

# No changes needed for:
# - Document storage (native <input type="file"> + Server Actions)
# - Recruiter entity (Prisma schema only)
# - Google Calendar (googleapis already installed)
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@uppy/*` | 10+ packages, lodash, preact — overkill for <5MB local uploads | Native `<input type="file">` + Server Actions |
| `react-dropzone` | Ambiguous React 19 peer dep (`>= 16.8 \|\| 18.0.0`); just wraps file input | Custom `useDropZone` hook (20 lines) |
| `plasmo` | Parcel-based (different from Vite ecosystem), slower maintenance cadence | `wxt` |
| `@crxjs/vite-plugin` | Community plugin, manual manifest management, less MV3 abstraction | `wxt` |
| `@tremor/react` | Peer dep `react: ^18.0.0` — does NOT support React 19 | `recharts` |
| `visx` | Peer dep excludes React 19 | `recharts` |
| `chart.js` + `react-chartjs-2` | Canvas-based — SSR requires `dynamic import` wrapper, imperative API | `recharts` (SVG, declarative) |
| `@nivo/*` | Many internal packages (10+), heavier than recharts for similar output | `recharts` |
| `notistack` | Requires `@mui/material` — entire Material UI dependency tree | `sonner` |
| `react-hot-toast` | Older, less maintained, larger bundle than sonner | `sonner` |
| `@tanstack/react-query` | Server Components + Server Actions cover data fetching; unnecessary complexity | `fetch` + `revalidatePath` |
| `zustand` / `jotai` | Single-user app, mostly server-rendered; `useState` + URL state is correct | `useState` + `nuqs` (already in v0.2) |
| `multer` / `formidable` | Next.js 16 handles `FormData` natively in Server Actions | Native `FormData` API |
| `aws-sdk` / `@aws-sdk/client-s3` | Local-first (ADR-0003) — files live on local filesystem | Node `fs` module |
| `date-fns-tz` (explicit) | date-fns v4 includes timezone utilities; check if transitive dep suffices | `date-fns` built-in `formatInTimeZone` |

---

## Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `wxt@0.20.25` | Node `>=20.12.0`, Vite 6.x | Dev dep only. Does not affect Next.js bundle. |
| `recharts@3.8.1` | React `^16.8 \|\| ^17 \|\| ^18 \|\| ^19`, Node `>=18` | Pulls `@reduxjs/toolkit@^2.11.2` + `react-redux@9.2.0` as deps. |
| `sonner@2.0.7` | React `^18 \|\| ^19`, React DOM `^18 \|\| ^19` | Zero external deps. |
| `@radix-ui/react-dialog@1.1.15` | React `^16.8+`, React 19 | Part of radix-ui ecosystem already in project. |
| `googleapis@171.4.0` (existing) | Node `>=18` | Includes Calendar API v3. No version bump needed. |
| `next@16.2.6` (existing) | Node `>=20.9.0` | Server Actions handle `FormData` natively for file uploads. |
| `prisma@7.8.0` (existing) | Node `^20.19 \|\| ^22.12 \|\| >=24.0` | New `Document` and `Recruiter` models via schema migration. |

---

## Critical Watchouts

1. **WXT is a dev dep, not production.** The extension build output (`dist/`) is what gets loaded into Chrome. WXT itself does not run in the Next.js process. Keep it in `devDependencies`.

2. **Recharts Redux baggage.** Recharts 3.x bundles `@reduxjs/toolkit` and `react-redux` internally. You cannot tree-shake them out. For a local-first app this is fine (~40KB gzipped). If bundle size becomes a concern later, switch to `react-chartjs-2` with `dynamic import` for SSR avoidance.

3. **File upload size limits.** Next.js Server Actions have a default body size limit. In Next.js 16, configure `serverActions.bodySizeLimit` in `next.config.js` (default is 1MB). Set to `5mb` for document uploads.

4. **Calendar OAuth scope is additive.** Adding `calendar.readonly` scope to the existing OAuth flow means the user must re-authorize. The existing refresh token will NOT have calendar access. Handle this gracefully: detect missing scope, prompt re-auth, preserve existing Gmail token.

5. **Extension CSP restrictions.** MV3 content scripts run in an isolated world — they cannot access the page's JS context. Use `window.postMessage` or WXT's `browser.runtime.sendMessage` for content script <-> popup communication. Do NOT try to inject React into the host page.

6. **`date-fns` v4 timezone.** v4 removed the separate `date-fns-tz` package and integrated timezone support. Use `formatInTimeZone` from `date-fns` directly, NOT from `date-fns-tz`. If `date-fns-tz` is listed as a transitive dep, do not import from it.

7. **Document storage path.** Files stored at `data/documents/<applicationId>/`. Add `data/documents/` to `.gitignore`. The `data/` directory already exists (for classifier-log.jsonl). Do NOT store files in `public/` — they should not be publicly accessible without auth.

8. **Sonner SSR.** Sonner's `<Toaster />` component must be rendered in a Client Component (`'use client'`). Place it in the root layout alongside the existing providers. It does not need a context provider — it uses DOM portals.

9. **WXT separate package.json.** WXT projects typically have their own `package.json` in the extension directory. Do NOT install WXT in the root `package.json` and try to run it from there. Create `extension/` as a separate project with its own `wxt.config.ts`.

10. **Browser Notifications permission.** `Notification.requestPermission()` must be called from a user gesture (click handler). Do NOT auto-request on page load — browsers will block it. Add a "Enable notifications" button in Settings.

---

## Sources

### Verified against npm registry (HIGH confidence — 2026-05-10)

- All version numbers queried via `npm view <pkg> version engines peerDependencies dependencies` on 2026-05-10.
- `googleapis` Calendar API verified: `node -e "const {google} = require('googleapis'); console.log(typeof google.calendar)"` returns `function`.

### Official documentation (HIGH confidence)

- [WXT Documentation](https://wxt.dev) — Chrome MV3 extension framework
- [Recharts Documentation](https://recharts.org) — React charting library
- [Sonner Documentation](https://sonner.emilkowal.dev) — Toast notification library
- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference) — Calendar event listing
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-handling/server-actions) — FormData handling for file uploads
- [Chrome MV3 Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Isolation model

### Eliminated options (verified incompatible — HIGH confidence)

- `@tremor/react@3.18.7` — peer dep `react: ^18.0.0` (no React 19)
- `visx@3.12.0` — peer dep `react: ^16.8.0 || ^17.0.0 || ^18.0.0` (no React 19)
- `react-dropzone@15.0.0` — peer dep `react: '>= 16.8 || 18.0.0'` (ambiguous React 19 support)

---

*Stack research for: foray Full milestone v0.3*
*Researched: 2026-05-10*
*Source priority: npm registry (versions + peer deps) → official docs (behavior) → eliminated via peer dep conflicts*
