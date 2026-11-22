# Batch 91 Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a members-only portal at `portal.learning-today.com`. Batch 91 students sign up with a join code, follow a catch-up guide for each real class, track and hand in homework, and talk in one discussion space. The owner runs it from an admin screen.

**Architecture:** A Next.js 16 App Router app in `portal/`, deployed to Vercel with Root Directory `portal`. Supabase provides Auth and Postgres. Row-level security plus a few triggers enforce every rule in the database. The app's server components read with the signed-in user's session, and server actions write. A server-only client holding the secret key is used only for admin-only operations: creating users, banning or deleting them, reset links, pinning threads, and the join code. Pure modules hold the status, time and Markdown logic, so it can be unit-tested.

**Tech Stack:** Next.js 16.4.x (TypeScript, App Router, `proxy.ts`), `@supabase/ssr` 0.12.x, `@supabase/supabase-js` 2.x, `marked` 16.x, `sanitize-html` 2.x, Vitest 4.x, `@playwright/test` 1.63.0 (matches the preinstalled browser), Supabase CLI 2.62.x (dev dependency) for the local stack.

**Spec:** `docs/superpowers/specs/2026-11-22-batch-portal-design.md`. Read it before starting any task.

## Global Constraints

- Cost: free tiers only (Vercel Hobby, Supabase Free, Resend Free). No paid services and no extra hosted services.
- The existing static site is untouched except in Task 9: the header link, home page mention, privacy page, `robots.txt` and README. The portal is never added to `sitemap.xml`.
- No secrets in the repo. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser. `SUPABASE_SECRET_KEY` is imported only from `portal/lib/supabase/admin.ts`, which starts with `import "server-only"`.
- Environment variables (`portal/.env.example` lists them): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` locally, `https://portal.learning-today.com` in production).
- Look: reuse the token values from `theme.css` (light and dark `--paper`, `--card`, `--ink`, `--mute`, `--line`, `--hot`, `--btn` `#c45f00`). Oswald for headings (uppercase), Inter for text, via `next/font/google`. Square orange buttons. No UI framework.
- Phone first: every page must work at 360 px wide with no horizontal scroll and tap targets at least 44 px.
- All dates are shown and entered in Pakistan time (`Asia/Karachi`, fixed UTC+5).
- Limits: full name 1–80 characters, titles 1–150, thread and post bodies 1–5,000, hand-in note up to 500. URLs must start with `http://` or `https://`.
- Rate limit: at most 10 threads plus posts per member per 10 minutes, enforced in the database.
- Copy is plain English and short. Error messages say what to do next. Students' emails are never shown to other students.
- Dependencies stay few. Anything beyond the Tech Stack list needs a one-line reason in the commit message.
- Commits end with the session's attribution lines. Never include a model name.

## Local environment (read once; every task's tests depend on it)

The local Supabase stack runs in Docker. In this cloud container:
- Docker's daemon is not running by default. Start it with `(dockerd > /tmp/dockerd.log 2>&1 &)`, wait about 8 seconds, then check that `docker ps` works.
- Images must come from Docker Hub: prefix commands with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`.
- The kernel has no IPv6, so Realtime crashes on start. `portal/supabase/config.toml` must set `[realtime] enabled = false`.
- Start command (wrapped in `npm run db:start`): `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start -x studio,imgproxy,vector,logflare,realtime,storage-api,edge-runtime,supavisor,postgres-meta`. This leaves db, auth, REST (PostgREST), the Kong gateway and Mailpit running.
- `npm run db:reset` re-applies all migrations to a clean database.
- `portal/scripts/write-env.sh` reads `supabase status -o env` and writes `portal/.env.local`, mapping the API URL, anon/publishable key and service/secret key onto the variables above. `.env.local` is gitignored.
- Mailpit (local email inbox) runs at `http://127.0.0.1:54324`, with API `GET /api/v1/messages` and `GET /api/v1/message/{ID}`.
- Playwright: run with `--trace off`. If `@playwright/test` does not find the browser, launch with `executablePath: '/opt/pw-browsers/chromium'`.

## Review Focus

1. **Bypassing the join code.** Someone calls Supabase's sign-up endpoint directly with the publishable key. It must be refused (public sign-ups disabled). The only way in is the server action that checks the code. Test: Task 5.
2. **A removed member still holding a session cookie.** Every page sends them to `/login?removed=1`, and the database returns nothing to them even through direct API calls. Tests: Task 2 (RLS) and Task 5 (e2e).
3. **Hostile content.** A post or class summary containing `<script>`, `onerror=`, or a `javascript:` link renders inert. A hand-in or material URL of `javascript:alert(1)` is rejected by the app and by the database. Tests: Task 3 (renderer), Task 2 (constraint).
4. **Deadline time zone and boundary.** A deadline entered as `2026-11-30T23:59` is stored as `2026-11-30T18:59:00Z`, shown as "30 Nov 2026, 11:59 pm", and counts as overdue from 18:59:00Z, not before. Test: Task 3.
5. **Double taps and repeats.** Tapping "I've reviewed this class" or "Hand in" twice, or editing a hand-in, leaves exactly one row and shows no error. Test: Task 7.

---

## File structure

```
portal/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
  .env.example, .gitignore, README.md, SETUP.md
  proxy.ts                         session refresh + redirect signed-out users
  public/                          logo.png, logo-dark.png, favicon.ico (copied from site root)
  supabase/
    config.toml                    local stack settings (realtime off, signups off, recovery template)
    templates/recovery.html        reset email: link to /auth/confirm with token_hash
    migrations/
      20261122000001_schema.sql    tables, constraints, helpers, RLS, grants, triggers
      20261122000002_seed.sql      settings row + Classes 1–6
  scripts/write-env.sh
  lib/
    supabase/server.ts             createClient() for server components and actions (user session)
    supabase/admin.ts              createAdminClient() (secret key, server-only)
    supabase/proxy.ts              updateSession(request)
    auth.ts                        getMember, requireMember, requireAdmin
    limits.ts                      length limits, validateHttpUrl
    time.ts                        Karachi conversion and formatting
    status.ts                      homework state + progress summary
    markdown.ts                    renderMarkdown
    errors.ts                      friendlyError
    progress.ts                    loadProgress (DB → status.ts)
  app/
    layout.tsx, globals.css, not-found.tsx
    components/                    Header, Nav, SubmitButton, FormMessage, Markdown, ThreadView, ReplyForm
    (auth)/login, signup, forgot-password, reset-password  pages + (auth)/actions.ts
    auth/confirm/route.ts          verifies token_hash (recovery) then redirects
    page.tsx                       dashboard
    classes/page.tsx, classes/[number]/page.tsx, classes/actions.ts
    discussions/page.tsx, discussions/new/page.tsx, discussions/[id]/page.tsx, discussions/actions.ts
    profile/page.tsx, profile/actions.ts
    admin/layout.tsx, admin/page.tsx, admin/classes/..., admin/handins/page.tsx,
    admin/members/page.tsx, admin/settings/page.tsx, admin/actions.ts
  tests/
    helpers/env.ts, helpers/members.ts, helpers/mailpit.ts
    unit/*.test.ts                 pure logic (no DB)
    db/*.test.ts                   RLS + triggers against the local stack
    e2e/*.spec.ts                  Playwright against next dev + local stack
```

Test commands (defined in Task 1): `npm run test:unit`, `npm run test:db`, `npm run test:e2e`, `npm test` (all three), `npm run build`, `npm run lint` (`tsc --noEmit` + `next lint` equivalent: use `eslint` only if `create-next-app` sets it up; otherwise `tsc --noEmit`).

---

### Task 1: Scaffold the portal app, local stack and test tooling

**Files:**
- Create: everything under `portal/` listed above except `lib/` logic, `app/` feature pages and `tests/` beyond the smoke tests below.
- Create: `portal/app/layout.tsx`, `portal/app/globals.css`, `portal/app/page.tsx` (temporary "Batch 91 Portal" heading, replaced in Task 7), `portal/app/components/Header.tsx`.
- Test: `portal/tests/unit/smoke.test.ts`, `portal/tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `test:unit`, `test:db`, `test:e2e`, `test`, `db:start`, `db:stop`, `db:reset`, `env:local`. CSS custom properties in `globals.css` named exactly as in `theme.css` (`--paper`, `--paper2`, `--card`, `--ink`, `--mute`, `--line`, `--hot`, `--onhot`, `--btn`, `--btn-hover`, `--green`) plus `--danger` (light `#a32020`, dark `#ff7b7b`). Utility classes used by later tasks: `.wrap` (max-width 52rem, 16px side gutter), `.btn` (orange square button), `.btn-quiet` (outlined), `.card`, `.stack` (vertical gap), `.muted`, `.badge`, `.badge-done`, `.badge-due`, `.badge-overdue`, `.badge-catchup`, `.form-row`, `.error`, `.notice`.
- Produces: `Header` renders the logo (light and dark via `<picture>` with `prefers-color-scheme`) linking to `https://learning-today.com`, plus a `children` slot for the nav (filled in Task 5).

- [ ] **Step 1: Create the app.** `npx create-next-app@16 portal --ts --app --no-tailwind --no-src-dir --eslint --import-alias "@/*" --use-npm`, then add dependencies `@supabase/ssr@0.12 @supabase/supabase-js@2 marked@16 sanitize-html@2 server-only` and dev dependencies `vitest@4 @playwright/test@1.63.0 supabase@2.62 @types/sanitize-html`. Delete the create-next-app sample content and images.
- [ ] **Step 2: Local stack config.** In `portal/`, run `npx supabase init`. Then edit `supabase/config.toml`: `project_id = "learning-today-portal"`; `[realtime] enabled = false`; `[studio] enabled = false`; `[storage] enabled = false`; `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/auth/confirm"]`, `enable_signup = false`; `[auth.email] enable_signup = true` (email/password provider on, but the public endpoint stays off through `auth.enable_signup = false`), `enable_confirmations = false`; `[auth.rate_limit] email_sent = 100`; `[auth.email.template.recovery] subject = "Reset your Batch 91 Portal password"`, `content_path = "./supabase/templates/recovery.html"`.
- [ ] **Step 3: Recovery template.** `supabase/templates/recovery.html` contains a short message and the link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
- [ ] **Step 4: Scripts.** Write `scripts/write-env.sh` (described in Local environment) and the npm scripts. `test:unit` = `vitest run tests/unit`. `test:db` = `vitest run tests/db --no-file-parallelism`. `test:e2e` = `playwright test --trace off`. `playwright.config.ts`: `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`, one Chromium project plus one `Pixel 7` project. Vitest loads `.env.local`, for example with `loadEnv` from `vite` in `vitest.config.ts`.
- [ ] **Step 5: Theme and layout.** Port the tokens and the fonts (Oswald 400/600, Inter 400/600) into `globals.css` and `layout.tsx`, with `<html lang="en">`, page title template `%s · Batch 91 Portal` and default title `Batch 91 Portal`. Copy `assets/logo.png`, `assets/logo-dark.png` and `favicon.ico` into `portal/public/`.
- [ ] **Step 6: Write the smoke tests.** `smoke.test.ts`: `expect(1 + 1).toBe(2)`, which proves Vitest runs. `smoke.spec.ts`: visit `/` and expect a heading containing "Batch 91 Portal" and an image with alt text "learning-today.com", and no horizontal scroll at 360 px (`document.documentElement.scrollWidth <= 360`).
- [ ] **Step 7: Run everything.** `npm run db:start && npm run env:local && npm run test:unit && npm run test:e2e && npm run build`. Expected: all pass. The stack prints the API URL `http://127.0.0.1:54321`.
- [ ] **Step 8: Commit.** `git add portal && git commit -m "portal: scaffold Next.js app, local Supabase stack and test tooling"`. Check that `.env.local`, `.next/`, `node_modules/` and `supabase/.temp/` are ignored.

---

### Task 2: Database schema, security rules, triggers and seed content

**Files:**
- Create: `portal/supabase/migrations/20261122000001_schema.sql`, `portal/supabase/migrations/20261122000002_seed.sql`
- Create: `portal/tests/helpers/env.ts`, `portal/tests/helpers/members.ts`
- Test: `portal/tests/db/rls.test.ts`, `portal/tests/db/triggers.test.ts`

**Interfaces:**
- Produces the tables below (names and columns are used by every later task):

| Table | Columns |
|---|---|
| `profiles` | `id uuid pk → auth.users(id) on delete cascade`, `full_name text not null` (1–80, trimmed), `role text not null default 'student'` (`student`/`admin`), `status text not null default 'active'` (`active`/`removed`), `joined_at timestamptz not null default now()` |
| `classes` | `id bigint identity pk`, `number int not null unique check (number > 0)`, `class_date date not null`, `title text not null` (1–150), `summary_md text not null default ''`, `status text not null default 'draft'` (`draft`/`published`), `created_at`, `updated_at timestamptz not null default now()` |
| `class_materials` | `id bigint identity pk`, `class_id → classes on delete cascade`, `label text not null` (1–150), `url text not null check (url ~* '^https?://')`, `position int not null default 0` |
| `homework` | `id bigint identity pk`, `class_id → classes on delete cascade`, `title text not null` (1–150), `instructions_md text not null default ''`, `deadline timestamptz null`, `handin_expected boolean not null default false`, `position int not null default 0` |
| `class_reviews` | `user_id → profiles on delete cascade`, `class_id → classes on delete cascade`, `reviewed_at timestamptz not null default now()`, pk `(user_id, class_id)` |
| `homework_status` | `user_id → profiles on delete cascade`, `homework_id → homework on delete cascade`, `done_at timestamptz not null default now()`, `handin_url text null check (handin_url ~* '^https?://')`, `note text null` (≤500), pk `(user_id, homework_id)` |
| `threads` | `id bigint identity pk`, `author_id uuid null default auth.uid() → profiles on delete set null`, `title text not null` (1–150), `body_md text not null` (1–5000), `class_id bigint null → classes on delete set null`, `is_class_thread boolean not null default false`, `pinned boolean not null default false`, `created_at`, `last_activity_at timestamptz not null default now()`, `edited_at timestamptz null`; unique partial index on `class_id where is_class_thread` |
| `posts` | `id bigint identity pk`, `thread_id → threads on delete cascade`, `author_id uuid null default auth.uid() → profiles on delete set null`, `body_md text not null` (1–5000), `created_at timestamptz not null default now()`, `edited_at timestamptz null` |
| `settings` | `id int pk default 1 check (id = 1)`, `join_code text not null` (4–64) |

- Produces SQL functions (security definer, `stable`, `set search_path = ''`): `public.is_active_member() returns boolean` (the caller's profile exists and has status `active`) and `public.is_admin() returns boolean` (active and role `admin`).
- Produces exception messages the app maps in Task 3's `friendlyError`: `RATE_LIMIT`, `HANDIN_REQUIRED`.
- Produces `tests/helpers/members.ts`: `adminClient(): SupabaseClient` (secret key); `createMember(opts?: { role?: 'student' | 'admin'; name?: string; status?: 'active' | 'removed' }): Promise<{ id: string; email: string; password: string; client: SupabaseClient }>`, which creates the user with `auth.admin.createUser({ email_confirm: true, user_metadata: { full_name } })`, sets role and status through the admin client, and returns a publishable-key client signed in as that user; `createClassFixture(opts?: { status?: 'draft' | 'published'; homework?: Array<{ deadline?: string | null; handin_expected?: boolean }> }): Promise<{ classId: number; number: number; homeworkIds: number[] }>`, which uses unique class numbers starting at 1000 to avoid the seed rows. `tests/helpers/env.ts` exports `SUPABASE_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY` and `SITE_URL` from `.env.local`.

**Rules to implement.** All tables have RLS enabled. Every policy also requires `public.is_active_member()`.
- `profiles`: select for any active member. Update own row only. Column grant: `authenticated` may update `full_name` only.
- `classes`: select if `status = 'published'` or `is_admin()`. Insert, update and delete only if `is_admin()`.
- `class_materials`, `homework`: select if the parent class is visible under the rule above. Write only if `is_admin()`.
- `class_reviews`: select own rows or `is_admin()`. Insert and delete own rows (class must be visible).
- `homework_status`: select for any active member (classmates' work and the admin overview). Insert, update and delete own rows only.
- `threads`: select for active members. Insert with `author_id = auth.uid()`; column grant on insert is `(title, body_md, class_id)`. Update own rows, with the column grant on update `(title, body_md)`. Delete own rows, except class threads, or anything if `is_admin()`. `pinned` and `is_class_thread` are never writable by `authenticated`: the admin pins through the secret-key client.
- `posts`: select for active members. Insert with `author_id = auth.uid()` into an existing thread; column grant on insert is `(thread_id, body_md)`. Update own rows (column `body_md`). Delete own rows or anything if `is_admin()`.
- `settings`: RLS on, no policies, and no grants to `anon` or `authenticated`.
- `anon` gets no table privileges at all.

**Triggers.**
- `on auth.users insert`: insert a `profiles` row, with `full_name` from `raw_user_meta_data->>'full_name'` and fallback `'Member'`.
- `before insert on threads, posts`: if the author has 10 or more rows across `threads` and `posts` with `created_at > now() - interval '10 minutes'`, raise `RATE_LIMIT`. Class threads are skipped.
- `before insert or update on homework_status`: if the homework has `handin_expected` and `handin_url` is null, raise `HANDIN_REQUIRED`.
- `after insert on posts`: set the thread's `last_activity_at = new.created_at`.
- `before update on threads (title, body_md)` and `posts (body_md)`: set `edited_at = now()`. `before update on classes`: set `updated_at = now()`.
- `after insert or update of status on classes`: when the status is `published` and no class thread exists, insert one with `author_id = auth.uid()` (it may be null), title `Questions about Class {number}`, body `Ask anything about Class {number}: {title}. Classmates and admins will reply here.`, `class_id`, and `is_class_thread = true`.

**Seed (`..._seed.sql`).** Insert `settings (join_code) = 'batch91-change-me'`. Insert Classes 1–6 as `published`, with these dates, titles and summaries, and one material each, using the URLs exactly as they appear in `index.html` lines 303–308:
1. 2026-10-18, "Intro to AI, LLMs and agents": "Intro to AI, LLMs and agents. Students build their first websites on Lovable." Material: "Slides: Agentic AI Engineering, introductory session".
2. 2026-10-25, "First look at the book": "First look at the book, The AI Agent Factory, second edition." Material: "The AI Agent Factory, second edition".
3. 2026-11-01, "Chapter 1: from chatbots to AI workers": same text. Material: "Class Quest: AI Worker Quest, the Chapter 1 game".
4. 2026-11-08, "Chapter 1, continued": same text. Material: as Class 3.
5. 2026-11-15, "Chapter 1 and coding agents": "Chapter 1: The New Way of Working, and coding agents: Claude Code and OpenCode setup." Two materials: "Claude 2.0 Practical, Chapter 1: The New Way of Working" and "Class slides: Claude Code and OpenCode setup".
6. 2026-11-22, "Chapter 2: Tour of the Apps": "Chapter 2: Tour of the Apps, and the commands you can use in Claude." Material: "Claude 2.0 Practical, Chapter 2: Tour of the Apps".

The class-thread trigger creates their six threads.

- [ ] **Step 1: Write the failing DB tests** in `rls.test.ts`, each in its own `it`:
  - `anon sees nothing`: a publishable-key client with no session gets `[]` or an error from `classes`, `profiles` and `threads`.
  - `student sees published classes only`: with fixtures for one draft class and one published class, the student's select on `classes` contains the published id and not the draft id. The admin sees both.
  - `student cannot write classes`: an insert into `classes` fails.
  - `student cannot read settings`: a select on `settings` returns an error or `[]`.
  - `student cannot change role, status or pinned`: `update profiles set role='admin'` on their own row fails. `update threads set pinned=true` on their own thread fails.
  - `student cannot review on behalf of someone else`: an insert into `class_reviews` with another `user_id` fails.
  - `classmates can read hand-ins`: student B selects student A's `homework_status` row and sees `handin_url`.
  - `removed member sees nothing`: create a member, then set status `removed` through the admin client. Their existing client now gets `[]` from `classes`, `threads` and `profiles`, and their insert into `threads` fails.
  - `javascript: URLs are rejected`: inserting into `homework_status` with `handin_url 'javascript:alert(1)'` fails.
- [ ] **Step 2: Write the failing trigger tests** in `triggers.test.ts`:
  - `new auth user gets a profile`: `createMember({ name: 'Ayesha Khan' })` results in a profile with `full_name 'Ayesha Khan'`, role `student` and status `active`.
  - `publishing a class creates exactly one class thread`: create a draft, publish it, update its title, publish again. Exactly 1 row in `threads` has that `class_id` and `is_class_thread`, titled `Questions about Class {n}`.
  - `rate limit`: a student inserts 10 posts successfully, and the 11th fails with a message containing `RATE_LIMIT`.
  - `hand-in required`: for homework with `handin_expected = true`, inserting a status without a URL fails with `HANDIN_REQUIRED`. With `https://example.com` it succeeds. For `handin_expected = false` without a URL, it succeeds.
  - `reply bumps last_activity_at`: after a reply, the thread's `last_activity_at` equals the post's `created_at`.
  - `deleting a user keeps their posts as Former member`: delete the author through `auth.admin.deleteUser`. Their thread and post remain with `author_id null`, and their `class_reviews` and `homework_status` rows are gone.
  - `seed is present`: after `db:reset`, `classes` has numbers 1–6 published, Class 5 has 2 materials, and there are 6 class threads.
- [ ] **Step 3: Run them to verify they fail.** `npm run test:db`. Expected: FAIL, because the tables don't exist yet.
- [ ] **Step 4: Write the two migrations** implementing the tables, functions, policies, grants, triggers and seed above.
- [ ] **Step 5: Apply and run.** `npm run db:reset && npm run test:db`. Expected: all pass.
- [ ] **Step 6: Commit.** `git commit -m "portal: database schema, row-level security, triggers and Batch 91 seed"`

---

### Task 3: Pure logic: limits, time, status, Markdown, errors

**Files:**
- Create: `portal/lib/limits.ts`, `portal/lib/time.ts`, `portal/lib/status.ts`, `portal/lib/markdown.ts`, `portal/lib/errors.ts`
- Test: `portal/tests/unit/limits.test.ts`, `time.test.ts`, `status.test.ts`, `markdown.test.ts`, `errors.test.ts`

**Interfaces (produced):**
```ts
// limits.ts
export const LIMITS = { name: 80, title: 150, body: 5000, note: 500, joinCodeMin: 4, joinCodeMax: 64 } as const;
export function validateHttpUrl(input: string): string | null; // trimmed URL if http(s) and parseable by new URL(), else null
export function cleanText(input: unknown, max: number): string | null; // trims; null if empty or longer than max

// time.ts  (Asia/Karachi, fixed +05:00)
export function karachiInputToISO(local: string): string;      // "2026-11-30T23:59" -> "2026-11-30T18:59:00.000Z"; throws on bad input
export function isoToKarachiInput(iso: string): string;        // inverse, for edit forms
export function formatDate(isoOrDate: string): string;         // "2026-11-15" or ISO -> "15 Nov 2026"
export function formatDateTime(iso: string): string;           // -> "30 Nov 2026, 11:59 pm"
export function formatRelative(iso: string, now?: Date): string; // "just now", "5 min ago", "3 h ago", else formatDate

// status.ts
export type HomeworkState = 'done' | 'due' | 'overdue' | 'catchup';
export interface HomeworkRef { id: number; classId: number; classNumber: number; title: string; deadline: string | null; handinExpected: boolean }
export interface ClassRef { id: number; number: number; title: string; classDate: string; homework: HomeworkRef[] }
export interface Progress {
  classesTotal: number; classesReviewed: number;
  due: HomeworkRef[]; overdue: HomeworkRef[]; catchup: HomeworkRef[]; doneCount: number;
}
export function homeworkState(hw: Pick<HomeworkRef, 'deadline'>, done: boolean, joinedAt: string, now: Date): HomeworkState;
export function summarize(classes: ClassRef[], reviewed: Set<number>, done: Set<number>, joinedAt: string, now: Date): Progress;
export function summaryLine(p: Progress): string;

// markdown.ts
export function renderMarkdown(md: string): string; // safe HTML

// errors.ts
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string;
```

**Rules:**
- `homeworkState` checks in this order: `done` → `'done'`. Deadline null → `'due'`. Deadline earlier than `joinedAt` → `'catchup'`. Deadline ≤ `now` → `'overdue'`. Otherwise `'due'`.
- `summarize` sorts `due` by deadline ascending with nulls last, then by class number. It sorts `overdue` by deadline ascending and `catchup` by class number.
- `summaryLine` builds `"{r} of {t} classes reviewed"`, then appends `" · {n} homework due"` if n > 0 and `" · {m} overdue"` if m > 0. If both are 0 and the classes have any homework, it appends `" · all homework done"`.
- `renderMarkdown` uses `marked` (GFM, `breaks: true`), then `sanitize-html` with the allowed tags `p br strong em del code pre blockquote ul ol li a h2 h3 h4 hr`. `h1` is rewritten to `h2`. On `a`, only `href` is allowed, with schemes `http https mailto`, and every link gets `target="_blank" rel="noopener nofollow"`. Everything else is stripped.
- `friendlyError`: a message containing `RATE_LIMIT` → "You're posting very fast. Please wait a few minutes and try again." `HANDIN_REQUIRED` → "This homework needs a link to what you made." `23505` (unique) → "That's already saved." Row-level-security denials (`42501`, or a message containing `row-level security`) → "You don't have permission to do that." Anything else → "Something went wrong. Please try again."

- [ ] **Step 1: Write the failing tests.** Include at least:
  - `validateHttpUrl('  https://x.dev/a ') === 'https://x.dev/a'`; `validateHttpUrl('javascript:alert(1)') === null`; `validateHttpUrl('ftp://x') === null`; `validateHttpUrl('not a url') === null`.
  - `cleanText('  hi  ', 5) === 'hi'`; `cleanText('   ', 5) === null`; `cleanText('abcdef', 5) === null`.
  - `karachiInputToISO('2026-11-30T23:59') === '2026-11-30T18:59:00.000Z'`; `isoToKarachiInput('2026-11-30T18:59:00.000Z') === '2026-11-30T23:59'`; `formatDateTime('2026-11-30T18:59:00.000Z') === '30 Nov 2026, 11:59 pm'`; `formatDate('2026-11-15') === '15 Nov 2026'`.
  - Boundary: `homeworkState({deadline:'2026-11-30T18:59:00.000Z'}, false, '2026-10-01T00:00:00Z', new Date('2026-11-30T18:58:59Z')) === 'due'`, and at `18:59:00Z` → `'overdue'`.
  - Late joiner: deadline `2026-11-01T00:00:00Z`, joined `2026-11-20T00:00:00Z`, now `2026-11-22` → `'catchup'`; done → `'done'`; deadline null → `'due'`.
  - `summarize` over 3 classes (2 reviewed) with one due, one overdue and one catch-up item gives `classesTotal 3`, `classesReviewed 2`, and one item in each list. `summaryLine` → `"2 of 3 classes reviewed · 1 homework due · 1 overdue"`. With everything done → `"3 of 3 classes reviewed · all homework done"`. With no homework at all → `"0 of 6 classes reviewed"`.
  - `renderMarkdown('<script>alert(1)</script>**hi**')` does not contain `<script` and contains `<strong>hi</strong>`. `renderMarkdown('[x](javascript:alert(1))')` does not contain `javascript:`. `renderMarkdown('<img src=x onerror=alert(1)>')` does not contain `onerror` or `<img`. `renderMarkdown('[a](https://a.dev)')` contains `target="_blank"` and `rel="noopener nofollow"`. `renderMarkdown('# Title')` contains `<h2>`.
  - `friendlyError({ message: 'RATE_LIMIT' })` returns the rate-limit sentence, `friendlyError({ code: '23505' })` returns "That's already saved.", and `friendlyError(null)` returns the generic sentence.
- [ ] **Step 2: Run to verify they fail.** `npm run test:unit`. Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Implement the five modules** with the signatures above. Use `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', ... })` for formatting, and lowercase "am/pm".
- [ ] **Step 4: Run to verify they pass.** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "portal: status, time, markdown, limits and error helpers with tests"`

---

### Task 4: Supabase clients, session proxy and member guards

**Files:**
- Create: `portal/lib/supabase/server.ts`, `portal/lib/supabase/admin.ts`, `portal/lib/supabase/proxy.ts`, `portal/proxy.ts`, `portal/lib/auth.ts`
- Test: `portal/tests/e2e/guard.spec.ts`

**Interfaces:**
- Produces: `createClient(): Promise<SupabaseClient>` (server.ts: `createServerClient` with `cookies()` `getAll`/`setAll`, where `setAll` is wrapped in try/catch for server components). `createAdminClient(): SupabaseClient` (admin.ts: `server-only`, secret key, `auth: { persistSession: false, autoRefreshToken: false }`). `updateSession(request: NextRequest): Promise<NextResponse>` (calls `supabase.auth.getClaims()`, copies cookies and the `cache-control`/`expires`/`pragma` headers onto the response, and redirects signed-out requests to `/login?next=<path>` unless the path is public).
- Public paths: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm`. `proxy.ts` exports `proxy` and a `config.matcher` that excludes `_next/static`, `_next/image`, `favicon.ico`, `logo*.png` and prefetches.
- Produces in `lib/auth.ts`:
  ```ts
  export interface Member { id: string; email: string; fullName: string; role: 'student' | 'admin'; status: 'active' | 'removed'; joinedAt: string }
  export async function getMember(): Promise<Member | null>;   // claims → profiles row via the user client; profile read with the admin client so a removed member is still identified
  export async function requireMember(): Promise<Member>;      // none → redirect('/login'); removed → signOut + redirect('/login?removed=1')
  export async function requireAdmin(): Promise<Member>;       // requireMember, then role !== 'admin' → redirect('/')
  ```
  Wrap `getMember` in React `cache()` so each request reads it once.

- [ ] **Step 1: Write the failing e2e test** `guard.spec.ts`: `signed-out visit to / redirects to /login?next=%2F`, and `signed-out visit to /admin redirects to login`. (The removed-member case is covered in Task 5, once login exists.)
- [ ] **Step 2: Run it to verify it fails.** `npx playwright test tests/e2e/guard.spec.ts --trace off`. Expected: FAIL, because `/` renders without a redirect.
- [ ] **Step 3: Implement the four files** as specified. Add a temporary `/login` page with heading "Log in" so the redirect target exists (replaced in Task 5).
- [ ] **Step 4: Run the test to verify it passes,** then `npm run build`.
- [ ] **Step 5: Commit.** `git commit -m "portal: Supabase clients, session proxy and member guards"`

---

### Task 5: Sign up with join code, log in, log out, password reset, navigation

**Files:**
- Create: `portal/app/(auth)/layout.tsx` (centered narrow card, logo, no nav), `portal/app/(auth)/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `portal/app/(auth)/actions.ts`, `portal/app/auth/confirm/route.ts`, `portal/app/components/Nav.tsx`, `portal/app/components/SubmitButton.tsx`, `portal/app/components/FormMessage.tsx`
- Modify: `portal/app/layout.tsx` (render `Header` with `Nav` when a member is signed in)
- Create: `portal/tests/helpers/mailpit.ts`
- Test: `portal/tests/e2e/auth.spec.ts`, `portal/tests/db/signup-closed.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `getMember`, `requireMember` (Task 4); `cleanText`, `LIMITS` (Task 3); test helpers (Task 2).
- Produces server actions in `(auth)/actions.ts`, all with the shape `(prev: FormState, formData: FormData) => Promise<FormState>`, where `export type FormState = { error?: string; ok?: string } | undefined` lives in `portal/lib/forms.ts`:
  - `signUp`: fields `full_name`, `email`, `password` (min 8), `join_code`. It compares `join_code` (trimmed, case-insensitive) with `settings.join_code`, read through the admin client. On mismatch the error is "That join code isn't right. Ask in the Batch 91 WhatsApp group for the current code." If they match, it calls `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`. If the email exists, the error is "There's already an account with that email. Log in instead, or reset your password." It then signs in with the user client and runs `redirect('/')`.
  - `logIn`: `email`, `password`, optional `next` (only relative paths starting with `/`). A wrong password gives "Email or password is wrong." A removed member is signed out and sees "This account has been removed. Contact the batch admin if you think this is a mistake."
  - `logOut`: signs out, then `redirect('/login')`.
  - `requestReset`: `email`. Calls `auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/auth/confirm?next=/reset-password' })` and always returns `ok`: "If that email has an account, a reset link is on its way. Check your inbox and spam folder."
  - `setNewPassword`: `password` and `confirm` (must match, min 8). Calls `auth.updateUser({ password })`, then `redirect('/?reset=1')`.
- `auth/confirm/route.ts`: a GET with `token_hash`, `type` and `next` calls `verifyOtp({ type, token_hash })`, redirects to `next` on success, and on failure goes to `/forgot-password?expired=1`, which shows "That link has expired or was already used. Request a new one."
- `Nav`: links Dashboard (`/`), Classes (`/classes`), Discussions (`/discussions`), plus Admin (`/admin`) for admins. A user menu with the member's first name opens Profile (`/profile`) and a Log out form. Use a `<details>` disclosure, with no client JS needed. The current page link gets `aria-current="page"` through a small client component reading `usePathname`.
- The login page shows a "Join the batch" link to `/signup`, and the signup page shows "Already a member? Log in". Login shows the `?removed=1` message when present.
- `tests/helpers/mailpit.ts`: `latestLinkTo(email: string, pathFragment: string): Promise<string>`, which polls `GET http://127.0.0.1:54324/api/v1/messages` for up to 10 s, finds the newest message to that address, fetches it and returns the first URL containing `pathFragment`.

- [ ] **Step 1: Write the failing tests.**
  - `signup-closed.test.ts`, `public sign-up endpoint is closed`: a publishable-key client calling `auth.signUp({ email: 'x@test.dev', password: 'password123' })` returns an error, and no profile with that email's id exists (Review Focus 1).
  - `auth.spec.ts`:
    - `wrong join code is refused`: fill the signup form with code `nope` and see the join-code error. No user is created (check with the admin client's `listUsers`).
    - `right join code signs up and lands on the dashboard`: with code `BATCH91-CHANGE-ME` (case-insensitive match with the seed), the URL is `/` and the nav shows Dashboard, Classes and Discussions, with no Admin link.
    - `log out and log back in`, then `wrong password shows a clear error`.
    - `next param is honoured but not open redirect`: `/login?next=/classes` goes to `/classes` after login. `/login?next=https://evil.dev` goes to `/`.
    - `password reset by email`: request a reset, `latestLinkTo(email, '/auth/confirm')`, open it, set a new password, log out, and log in with the new password.
    - `removed member is locked out` (Review Focus 2): log in, set status `removed` through the admin client, reload `/`, and expect `/login?removed=1` with the removal message. Logging in again shows the same message.
    - `admin sees Admin link`: a member created with role admin sees "Admin" in the nav.
- [ ] **Step 2: Run to verify they fail.** `npm run test:db -- signup-closed && npx playwright test tests/e2e/auth.spec.ts --trace off`. Expected: the DB test passes already (config from Task 1) and the e2e tests FAIL. If the DB test fails, fix `config.toml` first.
- [ ] **Step 3: Implement the pages, actions, confirm route, Nav and mailpit helper.**
- [ ] **Step 4: Run to verify they pass.** Then `npm run build`.
- [ ] **Step 5: Commit.** `git commit -m "portal: join-code sign-up, log in and out, email password reset, navigation"`

---

### Task 6: Discussions

**Files:**
- Create: `portal/app/discussions/page.tsx`, `portal/app/discussions/new/page.tsx`, `portal/app/discussions/[id]/page.tsx`, `portal/app/discussions/actions.ts`, `portal/app/components/ThreadView.tsx`, `portal/app/components/ReplyForm.tsx`, `portal/app/components/Markdown.tsx`
- Test: `portal/tests/e2e/discussions.spec.ts`

**Interfaces:**
- Consumes: `requireMember`, `createClient`, `createAdminClient` (Task 4); `renderMarkdown`, `formatRelative`, `cleanText`, `LIMITS`, `friendlyError` (Task 3); `FormState`, `SubmitButton`, `FormMessage` (Task 5).
- Produces `Markdown({ md }: { md: string })`, a server component that renders `renderMarkdown(md)` into a `div.prose` with `dangerouslySetInnerHTML`. This is the only place raw HTML is injected.
- Produces `ThreadView({ threadId, member, showTitle = true }: { threadId: number; member: Member; showTitle?: boolean })`, a server component that renders the opening post, then the replies oldest first. Each post shows author name ("Former member" when `author_id` is null), relative time, "(edited)" when edited, and Edit and Delete controls for the author. Delete is also available to admins. Below it is a `ReplyForm`. Task 7 reuses this inside the class guide.
- Produces server actions (all `(prev: FormState, fd: FormData) => Promise<FormState>`, each calling `requireMember()` first and `revalidatePath` on the affected pages):
  - `createThread`: `title`, `body`, optional `class_id`. On success, `redirect('/discussions/{id}')`.
  - `replyToThread`: `thread_id`, `body`.
  - `editPost`: `kind` (`thread` or `post`), `id`, `body`, plus optional `title` for threads. RLS ensures it's the user's own.
  - `deletePost`: `kind`, `id`. Deleting a thread redirects to `/discussions`.
  - `setPinned`: `thread_id`, `pinned` (`'true'`/`'false'`). Requires `requireAdmin()` and uses the admin client.
- Editing is inline: `?edit={kind}-{id}` on the thread page swaps that post for a form, with no client state needed.
- List page: pinned threads first, then by `last_activity_at` desc. Each row shows the title, a "Class N" badge when linked to a class, reply count, author and last activity. The empty state is "No discussions yet. Start the first one." with a button. A "New discussion" button sits at the top.
- New-thread page: title, body (with a hint that Markdown works: `**bold**`, lists, links), and an optional "About a class" select listing published classes.

- [ ] **Step 1: Write the failing e2e tests** in `discussions.spec.ts`. Seed members with `createMember`, and log in through the UI using a `loginAs(page, member)` helper added to `tests/helpers/members.ts`.
  - `start a thread and see it listed`: create thread "How do I install Claude Code?" with a body. It appears at the top of `/discussions`, and its page shows the body.
  - `reply and see last activity update`: student B replies, and the list shows the thread with "1 reply".
  - `markdown renders and scripts do not` (Review Focus 3): a body of `**bold** <script>window.__x=1</script> [link](https://a.dev)` shows bold text, `window.__x` stays undefined, and the link has `target=_blank`.
  - `author can edit and delete own reply; others cannot see the controls`: B sees no Edit or Delete on A's post. A edits, sees "(edited)", then deletes.
  - `admin can pin and delete any thread`: after the admin pins, the thread is listed first with a "Pinned" badge. When the admin deletes another member's thread, it's gone.
  - `rate limit message`: insert 10 posts for a member through their client, then try to reply in the UI and see "You're posting very fast…".
  - `class threads from the seed are listed`: "Questions about Class 6" is visible with a "Class 6" badge.
  - `too-long title is refused`: a 151-character title shows "Titles can be up to 150 characters." The form also sets `maxLength`, so fill it through `evaluate`.
- [ ] **Step 2: Run to verify they fail.** `npx playwright test tests/e2e/discussions.spec.ts --trace off`. Expected: FAIL, with a 404.
- [ ] **Step 3: Implement the pages, components and actions.**
- [ ] **Step 4: Run to verify they pass,** then `npm run build`.
- [ ] **Step 5: Commit.** `git commit -m "portal: discussions with replies, editing, pinning and safe markdown"`

---

### Task 7: Dashboard, classes, class guide, checklist and hand-ins, profile

**Files:**
- Create: `portal/lib/progress.ts`, `portal/app/page.tsx` (replaces the placeholder), `portal/app/classes/page.tsx`, `portal/app/classes/[number]/page.tsx`, `portal/app/classes/actions.ts`, `portal/app/profile/page.tsx`, `portal/app/profile/actions.ts`
- Test: `portal/tests/e2e/classes.spec.ts`, `portal/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `requireMember`, `createClient` (Task 4); `summarize`, `summaryLine`, `homeworkState`, `formatDate`, `formatDateTime`, `validateHttpUrl`, `cleanText`, `friendlyError` (Task 3); `Markdown`, `ThreadView` (Task 6); `FormState`, `SubmitButton` (Task 5).
- Produces in `lib/progress.ts`:
  ```ts
  export async function loadProgress(supabase: SupabaseClient, member: Member, now?: Date): Promise<{
    classes: ClassRef[];               // published, newest first
    reviewed: Set<number>;             // class ids
    done: Set<number>;                 // homework ids
    progress: Progress;
  }>;
  ```
- Produces server actions in `classes/actions.ts` (each calls `requireMember()` and revalidates `/`, `/classes` and `/classes/{n}`):
  - `setReviewed`: `class_id`, `reviewed` (`'true'`/`'false'`). True upserts into `class_reviews` with `onConflict` ignore, and false deletes. Both are idempotent (Review Focus 5).
  - `markHomework`: `homework_id`, optional `handin_url`, optional `note`. Validates the URL with `validateHttpUrl` (bad URL → "Links must start with http:// or https://"), then upserts `homework_status` on `(user_id, homework_id)`, so editing the link updates the same row.
  - `unmarkHomework`: `homework_id`. Deletes the user's row.
- Produces `updateProfile` in `profile/actions.ts`: `full_name` (1–80).

**Pages:**
- **Dashboard `/`:** a "Welcome back, {first name}" heading and the `summaryLine`. "Overdue" section (red badge) and "Due next" section, where each item shows the homework title, "Class N", its deadline or "No deadline", and a link to `/classes/{n}#hw-{id}`. Each section is hidden when empty. When nothing is due or overdue, it says "You're all caught up." A "Catch-up (optional)" section appears only for late joiners. A "Classes" list, newest first, shows each class's date, title, and a Reviewed or Not reviewed badge, plus "Homework: x of y done" when it has homework. "Latest discussions" shows 5 threads by last activity, with a link to all. `?reset=1` shows the notice "Your password has been changed."
- **Classes `/classes`:** the same class list as the dashboard, on its own page.
- **Class guide `/classes/[number]`:** returns 404 for unknown or unpublished numbers when the viewer is a student. The order is: header (Class N · date · title), "What was discussed" (`Markdown`), "Material" (link list, opens in a new tab), "Homework" (each item with `id="hw-{id}"`, title, deadline with its state badge, instructions `Markdown`, and the checklist control below), "Your checklist" ("I've reviewed this class" toggle button), "Classmates' work" (per homework item expecting a hand-in: name plus link for every hand-in, or "No hand-ins yet"), and "Questions about this class" (`ThreadView` for the class thread with `showTitle={false}`, plus a link to the full thread).
- **Homework control:** if a hand-in is expected, a URL field plus optional note and a "Hand in" button. Once handed in, it shows "Handed in: {link}" with Edit and Undo. If no hand-in is expected, a "Mark as done" button, which becomes "Done ✓" with Undo once done.
- **Profile `/profile`:** an editable name form, read-only email and joined date, and the summary line.

- [ ] **Step 1: Write the failing e2e tests.**
  - `classes.spec.ts`:
    - `seeded class guide shows summary, material and class thread`: `/classes/5` shows "Chapter 1 and coding agents", both material links, and the "Questions about Class 5" thread section.
    - `draft classes are hidden from students`: a draft fixture's `/classes/{n}` returns 404 for a student.
    - `mark reviewed twice is harmless` (Review Focus 5): click "I've reviewed this class", reload, click "Undo", click again quickly twice, and expect exactly 1 `class_reviews` row (checked through the admin client) and the "Reviewed" badge.
    - `hand-in flow`: on a fixture with `handin_expected`, submitting with an empty URL shows "This homework needs a link to what you made." Entering `javascript:alert(1)` shows the http/https error. Entering `https://my.site` shows "Handed in". Editing to `https://my2.site` leaves 1 row with the new URL. Classmate B sees A's name and link under "Classmates' work".
    - `mark as done without hand-in`: on a fixture without a hand-in, "Mark as done" shows "Done ✓", and Undo reverses it.
  - `dashboard.spec.ts`:
    - `summary line and due/overdue`: create a fixture class with one homework due in 2 days and one that was due yesterday. For a member who joined last week, the dashboard shows "1 homework due · 1 overdue", with each item under the right heading. After marking both done, "You're all caught up." appears.
    - `late joiner sees catch-up, not overdue`: for homework due before a new member's `joined_at`, it's listed under "Catch-up (optional)" and the Overdue heading is absent.
    - `profile name change shows in the greeting`.
    - `phone layout`: on the Pixel 7 project, the dashboard and `/classes/5` have no horizontal scroll.
- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement `loadProgress`, the pages and the actions.**
- [ ] **Step 4: Run to verify they pass,** then `npm run test:unit && npm run build`.
- [ ] **Step 5: Commit.** `git commit -m "portal: dashboard, class guides, homework hand-ins and profile"`

---

### Task 8: Admin: classes, hand-ins overview, members, settings

**Files:**
- Create: `portal/app/admin/layout.tsx` (calls `requireAdmin()`; sub-nav Classes · Hand-ins · Members · Settings), `portal/app/admin/page.tsx` (redirects to `/admin/classes`), `portal/app/admin/classes/page.tsx`, `portal/app/admin/classes/new/page.tsx`, `portal/app/admin/classes/[id]/page.tsx`, `portal/app/admin/classes/ClassForm.tsx`, `portal/app/admin/handins/page.tsx`, `portal/app/admin/members/page.tsx`, `portal/app/admin/settings/page.tsx`, `portal/app/admin/actions.ts`
- Test: `portal/tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `createClient`, `createAdminClient` (Task 4); `karachiInputToISO`, `isoToKarachiInput`, `formatDateTime`, `validateHttpUrl`, `cleanText`, `renderMarkdown` (Task 3); `Markdown` (Task 6); `FormState`, `SubmitButton` (Task 5).
- Produces server actions (each calls `requireAdmin()` first):
  - `saveClass`: fields `id?`, `number`, `class_date`, `title`, `summary_md`, `status`, and repeated groups `material_label[]`/`material_url[]` plus `hw_title[]`/`hw_instructions[]`/`hw_deadline[]` (Karachi `datetime-local`, may be empty)/`hw_handin[]` (checkbox values `'0'`/`'1'`, aligned by index using a hidden input per row). Writes run through the **user client**, so RLS confirms the caller is an admin. Materials are replaced wholesale on save. Homework is updated by id where present (hidden `hw_id[]`), inserted when new, and deleted when removed, so existing hand-ins survive edits. A duplicate number gives "Class {n} already exists." On success, `redirect('/admin/classes')`.
  - `deleteClass`: `id`, plus `confirm` must equal the class number typed by the admin. The warning reads: "This deletes the class, its homework and everyone's hand-ins for it."
  - `setClassStatus`: `id`, `status`.
  - `setMemberStatus`: `user_id`, `status`. Removing sets the profile status to `removed` and calls `auth.admin.updateUserById(id, { ban_duration: '876000h' })`. Restoring sets `active` and `ban_duration: 'none'`. An admin cannot remove themselves.
  - `setMemberRole`: `user_id`, `role`. An admin cannot demote themselves.
  - `resetLink`: `user_id`. Calls `auth.admin.generateLink({ type: 'recovery', email })` and returns `ok` with the link `${SITE_URL}/auth/confirm?token_hash=${properties.hashed_token}&type=recovery&next=/reset-password`, shown with a Copy button and the hint "Send this to them on WhatsApp. It works once."
  - `deleteMember`: `user_id`, plus `confirm` must equal the member's email. Calls `auth.admin.deleteUser(id)`. The trigger keeps their posts as "Former member".
  - `saveJoinCode`: `join_code` (4–64 characters, no spaces). Updates `settings` through the admin client.
- **Admin classes list:** all classes with number, date, title, a Draft/Published badge, hand-ins count, and Edit, Publish/Unpublish and View actions.
- **Class form:** a summary textarea with a "Preview" disclosure that renders on submit to `?preview=1`. Keep it server-side: a `previewMarkdown` action returns the HTML into `FormState.ok`. "Add material" and "Add homework" rows are added through a small client component that appends blank rows. Inputs carry `maxLength` attributes, and the deadline is labelled "Deadline (Pakistan time)".
- **Hand-ins overview:** a class select (default: the newest published class). For each homework item, a table of every active student with Done/Not done and the hand-in link if any, plus "x of y done". It also shows who has reviewed the class.
- **Members:** a table with name, email (from `auth.admin.listUsers`, admins only), role, status, joined date, classes reviewed and homework done. Row actions: Remove/Restore, Make admin/Make student, Reset link, Delete permanently (behind a confirm form).
- **Settings:** shows the current join code and a form to change it, with the hint "Post the new code in the WhatsApp group. Existing members are not affected."

- [ ] **Step 1: Write the failing e2e tests** in `admin.spec.ts`:
  - `students cannot open admin`: a student visiting `/admin/classes` is redirected to `/`.
  - `create, preview, publish a class with homework`: the admin creates Class 7 (date, title, summary `## Topics\n- agents`, one material, one homework with deadline `2026-12-06T23:59` and hand-in expected) as a draft. A student gets 404 on `/classes/7`. The admin publishes it. The student now sees it with the deadline "6 Dec 2026, 11:59 pm", and "Questions about Class 7" exists in `/discussions`.
  - `editing homework keeps hand-ins`: the student hands in on Class 7. The admin edits the homework title. The student's hand-in still shows.
  - `hand-ins overview`: shows the student as Done with their link, and the other student as Not done.
  - `remove and restore a member`: the admin removes a student. That student's next page load lands on `/login?removed=1`, and logging in fails. After a restore, the student can log in again.
  - `reset link works`: the admin generates a link for a student. Opening it in a fresh context lets them set a new password and log in.
  - `delete permanently keeps posts as Former member`: a student with a reply is deleted after confirming their email. The thread still shows the reply by "Former member".
  - `change join code`: after the admin sets `NEWCODE1`, sign-up with the old code fails and with `newcode1` it works.
  - `admin cannot remove or demote self`: those controls aren't shown on their own row, and posting the action directly returns an error.
- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement the admin pages, form and actions.**
- [ ] **Step 4: Run to verify they pass,** then run the full suite: `npm test && npm run build`.
- [ ] **Step 5: Commit.** `git commit -m "portal: admin for classes, hand-ins, members and join code"`

---

### Task 9: Main site integration, privacy, docs and setup guide

**Files:**
- Modify: `index.html`, `admin-links.html`, `student-websites.html`, `make-videos-with-claude.html`, `privacy.html` (header menu); `index.html` (resources card); `privacy.html` (portal section and date); `robots.txt`; `README.md`
- Create: `portal/README.md`, `portal/SETUP.md`
- Test: `portal/tests/unit/site-links.test.ts`

**Interfaces:**
- Consumes: nothing from code. It documents the env vars from Global Constraints and the Supabase settings from Task 1.

**Content:**
- In each page's `#site-menu`, add `<li><a href="https://portal.learning-today.com/" rel="noopener">Batch portal</a></li>` immediately before the "Enrol with PIAIC" item.
- `index.html` `#resources`: add a third card, "Batch 91 Portal", following the existing card markup: "Log in to follow each class step by step, track your homework and ask classmates questions. Members only: you need the batch join code." Link it to the portal.
- `privacy.html`: add a section "The Batch 91 Portal" covering: what is stored (name, email, password handled by Supabase, class reviews, homework status and hand-in links, posts); where (Supabase for accounts and data, Vercel for hosting, Resend for password-reset emails); who sees what (batch members see names, posts and hand-in links, and only admins see emails); removal (ask the admin; "Remove" locks the account and keeps posts, "Delete permanently" erases the account and progress and shows posts as "Former member"). Update the page date to the day of the change.
- `robots.txt`: add `Disallow: /portal/` and `Disallow: /docs/`.
- `README.md`: add rows for the portal in "The pages" (with the URL) and "Every file" (`portal/`, `docs/`), and a sentence that the portal has its own README.
- `portal/README.md`: what it is, the local development commands (including the Local environment workarounds), the test commands, and the folder map.
- `portal/SETUP.md`: click-by-click setup for a non-developer, in this order:
  1. **Supabase:** create the project (region close to Pakistan, for example Mumbai `ap-south-1`). Open the SQL Editor and run `migrations/…01_schema.sql`, then `…02_seed.sql`. Under Authentication → Sign In / Providers, turn off "Allow new users to sign up" and turn off "Confirm email". Under URL Configuration, set Site URL `https://portal.learning-today.com` and add the redirect URL `https://portal.learning-today.com/auth/confirm`. Under Emails → Templates → Reset password, paste the subject and body from `supabase/templates/recovery.html`. Copy the Project URL, publishable key and secret key from Project Settings → API Keys.
  2. **Resend:** add the domain `learning-today.com` and add the DNS records it shows at the DNS provider. Once verified, create an SMTP key. In Supabase → Authentication → Emails → SMTP Settings, enable custom SMTP with host `smtp.resend.com`, port 465, user `resend`, password = the key, and sender `no-reply@learning-today.com`, name "Batch 91 Portal".
  3. **Vercel:** create a project by importing the GitHub repo `tskhan/learning-today`. Set Root Directory to `portal`, keep the Next.js framework preset, and add the 4 environment variables. Deploy.
  4. **Domain:** in Vercel → Project → Domains, add `portal.learning-today.com`. At the DNS provider, add the CNAME record Vercel shows (`portal` → `cname.vercel-dns.com` or the value Vercel gives).
  5. **Make yourself admin:** sign up at the portal with the join code `batch91-change-me`. In Supabase → Table Editor → `profiles`, set your row's `role` to `admin`. Then, in Admin → Settings, change the join code and post it in the group.
  6. **Check:** log out, use "Forgot password?" and confirm the email arrives. Open a class guide on a phone.
  - Plus a "Keeping it awake" note: free Supabase projects pause after 7 days with no activity, and you restore them from the Supabase dashboard with one click.

- [ ] **Step 1: Write the failing test** `site-links.test.ts`, which reads the five HTML files from `..` (the repo root) and asserts that each contains exactly one `href="https://portal.learning-today.com/"` inside `#site-menu`. It also asserts that `robots.txt` contains `Disallow: /portal/`, that `sitemap.xml` does not contain `portal`, and that `privacy.html` contains "The Batch 91 Portal".
- [ ] **Step 2: Run to verify it fails.** `npx vitest run tests/unit/site-links.test.ts`. Expected: FAIL.
- [ ] **Step 3: Make the site edits and write both docs.**
- [ ] **Step 4: Run to verify it passes.** Open `index.html` and `privacy.html` with Playwright at 360 px and 1280 px, and confirm the menu still collapses and expands and the new card fits with no horizontal scroll.
- [ ] **Step 5: Commit.** `git commit -m "Link the Batch 91 Portal from the site, update privacy and docs, add setup guide"`

---

### Task 10: Final verification

- [ ] **Step 1:** `cd portal && npm run db:reset && npm test && npm run build`. Expected: all green. Record the counts of unit, DB and e2e tests in the final report.
- [ ] **Step 2:** Take phone-size screenshots (Pixel 7, `deviceScaleFactor` from the device) of the dashboard, a class guide, discussions and admin classes, in light and dark mode, into the scratchpad for the owner to see.
- [ ] **Step 3:** Run `git status` to confirm nothing unintended is uncommitted (no `.env.local`, no `node_modules`), then push the branch.
