# Batch 91 Portal

The members-only portal for PIAIC Batch 91 at **https://portal.learning-today.com**. Students sign up with the batch join code, follow a catch-up guide for every class (what was discussed, the material, homework with deadlines and hand-in links), track what they owe on a dashboard, and talk in one discussion space. Admins publish class guides, see hand-ins and manage members.

- Design: [`../docs/superpowers/specs/2026-11-22-batch-portal-design.md`](../docs/superpowers/specs/2026-11-22-batch-portal-design.md)
- Plan: [`../docs/superpowers/plans/2026-11-22-batch-portal.md`](../docs/superpowers/plans/2026-11-22-batch-portal.md)
- **Going live:** [`SETUP.md`](SETUP.md), click-by-click for Supabase, Resend, Vercel and DNS.

## How it's built

- **Next.js 16** (App Router, TypeScript, `proxy.ts`), deployed on **Vercel** with Root Directory `portal`.
- **Supabase** for logins and the Postgres database. Every rule (who can read or write what, the join code, the posting limit, hand-in links being required) is enforced in the database with row-level security and triggers, as well as in the app. See `supabase/migrations/`.
- Plain CSS in `app/globals.css`, using the same colours and fonts as the main site's `theme.css`.
- Markdown in class summaries and posts is rendered on the server and sanitised (`lib/markdown.ts`).
- All dates are shown and entered in Pakistan time (`lib/time.ts`).

## Folder map

| Path | What it is |
|---|---|
| `app/(auth)/` | Log in, join the batch, forgot and reset password |
| `app/auth/confirm/` | Opens password-reset links |
| `app/(member)/` | Everything behind the login: dashboard, `classes/`, `discussions/`, `profile/`, `admin/` |
| `app/components/` | Shared pieces: header and nav, thread view, homework control, forms |
| `lib/` | Supabase clients, member guards, status rules (due, overdue, catch-up), time, Markdown, limits |
| `proxy.ts` | Refreshes the login cookie and sends signed-out visitors to `/login` |
| `supabase/` | Local stack config, the reset-email template and the database migrations |
| `tests/unit/` | Pure logic and main-site link checks (no database) |
| `tests/db/` | Database rules and triggers, against the local stack |
| `tests/e2e/` | Browser tests of every flow (Playwright) |

## Running it locally

Needs Node 22 and Docker.

```bash
npm install
npm run db:start      # starts a local Supabase (database, auth, email inbox)
npm run env:local     # writes .env.local from the local stack
npm run dev           # http://localhost:3000
```

Local sign-up code: `batch91-change-me`. Emails (password resets) land in the local inbox at http://127.0.0.1:54324. Make yourself admin locally with:

```bash
docker exec supabase_db_learning-today-portal psql -U postgres -c "update profiles set role='admin' where id=(select id from auth.users where email='you@example.com');"
```

In a Claude Code cloud container, first start Docker with `(dockerd > /tmp/dockerd.log 2>&1 &)`. `npm run db:start` already pulls images from Docker Hub and skips the services the portal doesn't use (Realtime crashes there because the container has no IPv6, so `supabase/config.toml` turns it off).

## Tests

```bash
npm run test:unit   # logic, ~1 s
npm run test:db     # database rules and triggers (needs db:start)
npm run test:e2e    # browser flows, starts the dev server itself
npm test            # all three
npm run db:reset    # re-apply migrations to a clean local database
```

## Changing the database

Add a new file in `supabase/migrations/` (never edit one that has already been run in production), test it with `npm run db:reset && npm run test:db`, then run the same SQL in the Supabase SQL Editor for the live project.
