# Setup — `foray`

Step-by-step setup. Two paths: pick the one that matches your situation.

- **Path A — Native dev** is faster for daily iteration. Recommended for the project owner doing real work.
- **Path B — Full Docker** is fully reproducible. Recommended for fresh machines, AI agents (Claude Code, Cursor), or anyone who wants one command to start everything.

Both paths land at `http://localhost:3000` with hot reload.

---

## Prerequisites

| | Required version | Check |
|---|---|---|
| Node.js | ≥ 20 | `node -v` |
| pnpm | ≥ 10 | `pnpm -v` (install: `npm i -g pnpm`) |
| Docker Desktop (Mac/Win) or Docker Engine (Linux) | ≥ 24 | `docker info` (must run without error) |
| Git | any recent | `git -v` |

You also need:

- **Anthropic API key** — get one at https://console.anthropic.com → Settings → API Keys
- **Google Cloud project + OAuth client** — for Gmail API access. See [Connecting Gmail](#connecting-gmail) below.

---

## Path A — Native dev (fast)

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# → open .env.local, fill in ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 3. Start Postgres (in Docker, even on Path A — saves you from installing Postgres locally)
docker compose up -d db

# 4. Run database migrations
pnpm prisma migrate dev

# 5. Optional: seed demo data
pnpm seed

# 6. Start the dev server
pnpm dev
# → http://localhost:3000
```

When you stop work:

```bash
# Stop the dev server: Ctrl+C
docker compose down       # stop Postgres
```

---

## Path B — Full Docker (reproducible)

```bash
# 1. Configure environment
cp .env.example .env
# → open .env, fill in ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 2. Start everything (app + Postgres) with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# → first run: ~2-3 min while images build + deps install
# → subsequent runs: ~10 seconds
# → http://localhost:3000
```

When you stop work:

```bash
# Ctrl+C in the foreground terminal, or:
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

To rebuild the dev image (after `package.json` changes):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml build app
```

---

## Connecting Gmail

`foray` reads your Gmail to auto-classify rejections, interview invites, and recruiter outreach. This requires a Google Cloud project + OAuth client. **The app stays in "Test mode" — it's only ever you.**

### One-time Google Cloud setup

1. Go to https://console.cloud.google.com → create a new project (name: `foray-personal`)
2. **APIs & Services → Library → enable "Gmail API"**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Publishing status: **Testing** (do not publish)
   - App name: `foray`
   - User support email: your email
   - Test users: add your own Gmail address (this is the *only* email that can authenticate)
   - Scopes: add **`.../auth/gmail.readonly`** (this is a "restricted" scope — Test mode is fine for personal use, do NOT click "publish app")
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/gmail/callback`
   - Save → copy `Client ID` and `Client secret`
5. Paste those values into `.env.local` (Path A) or `.env` (Path B):

   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
   ```

### First-time connection in the app

1. Start the dev server (Path A or B)
2. Open `http://localhost:3000/settings`
3. Click **Connect Gmail** → you'll be redirected to Google
4. Approve the (scary-looking, because Test mode) consent screen → redirected back
5. Settings page will show "Connected as: your-email@gmail.com" + "Last sync: never"
6. Click **Sync now** to trigger the first poll, or wait 15 minutes for the cron

### Re-authentication

OAuth refresh tokens last ~6 months. If sync stops working with `invalid_grant` errors:

1. `/settings` → **Disconnect Gmail**
2. **Connect Gmail** again

---

## Connecting Anthropic (for the classifier)

`foray` uses Claude Haiku as a fallback classifier when rules-based classification has low confidence. Without it, low-confidence emails still go to the review queue — they just don't get an LLM-suggested label.

1. Get an API key: https://console.anthropic.com → Settings → API Keys → Create Key
2. Paste into `.env.local` (Path A) or `.env` (Path B):

   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

Cost estimate: rules-first classification handles ~80% of emails (free). LLM fallback runs ~20% of the time. At Haiku pricing (~$0.0005 per email), expect **<$1/month** for normal job-hunt volume.

---

## Common troubleshooting

### "Docker daemon not running"

Open Docker Desktop. Wait for the whale icon to settle. Re-run the command.

### "Port 3000 already in use"

Another Next.js project is running. Stop it, or change foray's port:

```bash
PORT=3001 pnpm dev
```

### "Migration failed: database does not exist"

Postgres container hasn't started yet, or migrated against a stopped DB:

```bash
docker compose up -d db
pnpm prisma migrate dev
```

### "Gmail sync returns 0 emails forever"

- Check `/settings` shows "Connected" (re-auth if needed)
- Verify your test email is added under OAuth consent screen → Test users
- Check `data/foray-sync.log` for actual error
- Most common cause: scope mismatch — make sure `gmail.readonly` is in OAuth consent screen scopes

### "LLM classifier returns 'API key invalid'"

`.env.local` (or `.env`) has a typo. Refresh the key from console.anthropic.com.

### "Hot reload not working in Docker (Path B)"

File-watching across the volume mount can be flaky on Mac. Add this to `docker-compose.dev.yml` if needed:

```yaml
environment:
  - WATCHPACK_POLLING=true
```

(Slower but reliable.)

### Reset everything

```bash
# Wipe DB + start fresh
docker compose down -v          # -v removes the postgres volume
pnpm prisma migrate dev          # recreates schema
pnpm seed                        # repopulates demo data
```

---

## Where to go next

- **[README.md](./README.md)** — what foray is and why
- **[AGENTS.md](./AGENTS.md)** — for AI agents working in this repo
- **[CLAUDE.md](./CLAUDE.md)** — coding rules
- **[docs/milestones/lean.md](./docs/milestones/lean.md)** — current sprint scope
