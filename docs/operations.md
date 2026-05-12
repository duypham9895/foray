# Operations Notes

These notes capture project-specific operational context for future Codex sessions.

## Hostinger Production

- SSH alias: `openclaw`
- App directory: `/home/duy/foray`
- Public URL: `https://duyopenclaw.tech`
- Production Compose file: `/home/duy/foray/docker-compose.prod.yml`
- Deployment Dockerfile: `/home/duy/foray/Dockerfile.deploy`
- App container binds `127.0.0.1:3001->3000`
- Caddy terminates HTTPS and reverse-proxies to `127.0.0.1:3001`
- The server `.env` is secret-bearing; never print it or copy values into chat.

Useful production checks:

```bash
ssh openclaw
cd /home/duy/foray
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs app --tail=100
```

## Common Requests

When the user says `reload Foray env on Hostinger`, run:

```bash
ssh openclaw
cd /home/duy/foray
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

When deploying code to Hostinger, sync the changed source, rebuild the image, recreate the app, then smoke-check:

```bash
rsync -az --exclude='src/generated/prisma' src/ openclaw:/home/duy/foray/src/
rsync -az scripts/ openclaw:/home/duy/foray/scripts/
ssh openclaw 'cd /home/duy/foray && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d --force-recreate app'
curl -I https://duyopenclaw.tech/login
```

## OAuth Notes

Google OAuth redirect URIs must exactly include:

- `https://duyopenclaw.tech/api/gmail/callback`
- `https://duyopenclaw.tech/api/calendar/callback`

Callback redirects must use forwarded proxy headers through `getPublicOrigin(request)`, not `request.nextUrl.origin`, because the container sees `0.0.0.0:3000`.

## Gmail Import Notes

Gmail sync stores and classifies emails. The inbox application importer creates application records only from strong application evidence:

- application received / thanks for applying
- interview invitation or next-steps thread
- rejection/update on an application

Do not create applications from generic LinkedIn, Glassdoor, or Indeed job-alert emails unless the email also contains a clear submitted-application signal. Job alerts are recommendations, not applied jobs.

The first production Gmail import reconstructed these applications from email evidence:

- Nimble - Senior Technical Product Manager - rejected
- Stripe - Product Manager, SEA - rejected
- CBTW - Technical Associate Product Manager - applied
- Assurity Trusted Solutions - Technical Product Manager / Senior Technical Product Manager - rejected
- Binance - Role at Binance - applied
- Axon - Sr Technical Program Manager I - applied
- HRS - Product Manager (all genders) - applied
- Shopee - Technical Product Manager - Marketplace - applied
