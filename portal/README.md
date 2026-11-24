# Batch 91 Portal

The members-only portal for PIAIC Batch 91 at **https://portal.learning-today.com**. Students sign up with the batch join code, follow a catch-up guide for every class (what was discussed, the material, homework with deadlines and hand-in links), track their reading and homework on a dashboard, and talk in one discussion space. Admins publish class guides, see hand-ins and manage members.

- **Going live / setting up a new project:** [`SETUP.md`](SETUP.md), click-by-click for Supabase, Resend, Vercel and DNS.
- Original design and build plan: [`../docs/superpowers/specs/2026-11-22-batch-portal-design.md`](../docs/superpowers/specs/2026-11-22-batch-portal-design.md) and [`../docs/superpowers/plans/2026-11-22-batch-portal.md`](../docs/superpowers/plans/2026-11-22-batch-portal.md) (historical: they describe the first version; this README describes the code as it is now).

## What it does

**Students**
- **Join and log in:** join with the batch join code (checked on the server; after 10 wrong codes from one network in 15 minutes, sign-up pauses there), log in, reset a forgotten password by email. The sign-in pages show a large learning-today logo beside the form on wide screens.
- **Dashboard:** "Welcome, Name" on the day they join and "Welcome back, Name" after that; overdue and due-next homework, optional catch-up homework for late joiners, the class list, and the latest discussions in a side column.
- **Classes:** every published class with Reviewed / Not reviewed and homework progress, and a **Your progress** card (reading and homework bars, what to do next).
- **Class guide:** what was discussed, the material, homework with deadlines, hand-in links and a private note, "I've reviewed this class", classmates' work, and the class's question thread beside the guide on wide screens.
- **Discussions:** threads with reply counts, pinned threads, class badges and quick links to every class's question thread. Authors edit or delete their own posts.
- **Writing a message:** a formatting-as-you-type editor (bold, italic, underline, strikethrough, lists, quote, code, links) and up to 4 pictures per message, pasted (Ctrl+V), dropped or picked with 📎. Pictures are shrunk in the browser (1600 px, WebP) before upload, which also drops hidden details such as location, and are shown under the message; a reply can be pictures only. Hovering a picture shows a magnifier; clicking opens it large in the page (← → between pictures; Esc, a click outside or × closes).
- **Replying to a particular message:** Reply on any reply quotes it (author and first line) at the top of the new reply, linking back to it, like WhatsApp; if the original is deleted the quote says so.

**Admins** (Admin in the menu)
- Publish, edit, unpublish and delete class guides, with the same editor and pictures for "What was discussed" (with headings) and each homework's instructions. Saving is all-or-nothing.
- See who handed in what; manage members (make admin, remove and restore, one-time reset link, delete for good); change the join code (at least 10 characters).

Deleting asks in the portal's own dialog (never the browser's pop-up). One-click buttons (Publish, Pin, Delete, Remove, Reviewed, Undo) show a message if they can't do their job, and forms keep what was typed when something is refused. All dates are shown and entered in Pakistan time.

## How it's built

| Part | Details |
|---|---|
| App | **Next.js 16.4** (App Router, TypeScript, React 19.3, `proxy.ts`), deployed on **Vercel** with Root Directory `portal`. Plain CSS in `app/globals.css`, using the main site's colours and fonts. |
| Data and logins | **Supabase**: Auth for accounts, Postgres for data, through `@supabase/ssr` and `@supabase/supabase-js`. Password-reset emails go out through **Resend**. The secret key is only used on the server (`lib/supabase/admin.ts` is `server-only`). |
| Rules | Enforced **in the database** as well as in the app: row-level security on every table, column-level grants (hand-in notes are readable only by their author), picture lists (at most 4, members' own uploads only), quoted replies in the same discussion only, and triggers for the posting limit, required hand-in links, class question threads (opened on publish, hidden while a class is a draft, renamed on renumbering, closed on delete) and edit marks. New accounts start as removed; only the join form activates them. Saving a class goes through one `save_class_with_images()` function, in one transaction. |
| Editor and Markdown | **Tiptap 3.33** (`@tiptap/react`, `starter-kit`, `markdown`, pinned) in `app/components/Composer.tsx`, saving **Markdown**. On the server it's rendered with `marked` 18 and sanitised with `sanitize-html` (`lib/markdown.ts`): no scripts, images or styles, only http(s) and mailto links; `<u>` is allowed for underline. |
| Pictures | A private **Supabase Storage** bucket, `post-images`: members can see pictures, each member uploads only into their own folder, the uploader or an admin deletes. Pictures are shown through signed links that last an hour (`lib/images-server.ts`), and their files are deleted with the message, discussion or class (or when removed in an edit). Uploads go through a server action (`app/actions/images.ts`, 2 MB request limit). |
| Security headers | Every response refuses to be framed by other sites and sends nosniff, referrer and permissions policies (`next.config.ts`). |
| Tests | **Vitest 5** (with Vite 8) for unit and database tests, **Playwright 1.65** for browser tests on desktop and phone, and the **Supabase CLI 3** for the local database. |

### The database (`supabase/migrations/`)

Ten tables: `profiles`, `classes`, `class_materials`, `homework`, `class_reviews`, `homework_status`, `threads`, `posts`, `settings` (the join code; only the server can read it) and `signup_attempts` (wrong join codes, kept 24 hours; only the server can use it). Pictures are listed in `threads.images`, `posts.images`, `classes.summary_images` and `homework.images`; the files live in the `post-images` storage bucket.

| File | What it adds |
|---|---|
| `20261122000001_schema.sql` | Tables, grants, row-level security, triggers |
| `20261122000002_seed.sql` | Classes 1–6 and the starting join code |
| `20261123000001_explicit_grants.sql` | Lets the server's secret key use the tables (newer Supabase projects need this) |
| `20261123000002_security_hardening.sql` | Join-code attempt log, new accounts start removed, private hand-in notes |
| `20261124000001_portal_improvements.sql` | `save_class()`, hidden draft-class threads, renaming threads on renumbering |
| `20261124000002_rich_posts.sql` | Pictures (columns, the `post-images` bucket and its rules), quoted replies, picture-only replies, `save_class_with_images()` |

Each file says at the top whether to run it in the live project's SQL Editor **before or after** merging the matching code. Never edit a file that has already run; add a new one.

## Folder map

| Path | What it is |
|---|---|
| `app/(auth)/` | Log in, join the batch, forgot and reset password (`actions.ts` has the server actions) |
| `app/auth/confirm/` | Opens password-reset links |
| `app/(member)/` | Everything behind the login: dashboard (`page.tsx`), `classes/`, `discussions/`, `profile/`, `admin/` |
| `app/components/` | Header and nav, thread view, the message editor with pictures (`Composer`), pictures in messages and the in-page viewer (`PostImages`, `ImageGallery`), dialogs on the native `<dialog>` (`Modal`, `ConfirmButton`), homework control, progress card, the error banner (`FlashError`), forms |
| `app/actions/` | Server actions shared across pages: picture upload and discard (`images.ts`) |
| `lib/` | `auth` (member and admin guards), `progress` and `status` (due, overdue, catch-up), `greeting`, `flash` (error codes and messages), `signup-throttle`, `markdown` (rendering and quote excerpts), `images` and `images-server` (picture rules, signed links, clean-up), `shrink-image` (in the browser), `time`, `limits`, `errors`, `forms`, and `supabase/` clients |
| `proxy.ts` | Refreshes the login cookie and sends signed-out visitors to `/login` |
| `supabase/` | Local stack config (`config.toml`), the reset-email template and the migrations |
| `tests/unit/` | Logic, plus checks on the main site: menu links and the student gallery (`../tools/check-student-gallery.mjs`) |
| `tests/db/` | Every database rule and trigger, against the local stack |
| `tests/e2e/` | Browser tests of every flow (Playwright) |

## Running it locally

Needs Node 22 and Docker (only for the local database; the live portal doesn't use Docker).

```bash
npm install
npm run db:start      # local Supabase: database, logins, email inbox
npm run env:local     # writes .env.local from the local stack
npm run dev           # http://localhost:3000
```

Local sign-up code: `batch91-change-me`. Emails (password resets) land in the local inbox at http://127.0.0.1:54324. Make yourself admin locally with:

```bash
docker exec supabase_db_learning-today-portal psql -U postgres -c "update profiles set role='admin' where id=(select id from auth.users where email='you@example.com');"
```

In a Claude Code cloud container: start Docker first with `(dockerd > /tmp/dockerd.log 2>&1 &)`. `npm run db:start` pulls images from Docker Hub, runs Storage for pictures, and skips the services the portal doesn't use (Realtime needs IPv6, which the container lacks, so `supabase/config.toml` turns it off). If Docker Hub answers "429 Too Many Requests", wait and try again later.

## Tests

```bash
npm run test:unit   # logic and main-site checks, a few seconds
npm run test:db     # database rules and triggers (needs db:start)
npm run test:e2e    # browser flows; starts the dev server itself
npm test            # all three
npm run db:reset    # re-apply all migrations to a clean local database
npm run lint        # type check and ESLint
```

The browser tests need Playwright's Chromium (`npx playwright install chromium`). Where another Chromium is already installed, as in Claude Code cloud containers, point at it instead:

```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

## Updating packages

Dependabot (`../.github/dependabot.yml`) opens pull requests for this folder: security fixes as soon as they're published, and routine updates on the 1st of each month (minor and patch updates grouped into one pull request, major ones separately). TypeScript major updates are held back until `typescript-eslint` supports TypeScript 7.

Before merging one, check it out (or merge it into a copy of `main`) and run `npm ci`, `npm run lint`, `npm test` and `npx next build`. Vercel also builds a preview of each pull request. This project installs with `legacy-peer-deps` (`.npmrc`), so a package that newly needs a peer dependency must have it added to `package.json` explicitly (as `vite` was for Vitest 5).

## Changing the database

Add a new file in `supabase/migrations/`, say at the top whether it runs before or after the code is merged, test it with `npm run db:reset && npm run test:db`, then run the same SQL in the Supabase SQL Editor for the live project, in date order.
