# Batch 91 Portal: design

Date: 2026-11-22. Status: ready for owner approval.

## Intent and why

learning-today.com is a public, static site (GitHub Pages) that records what PIAIC Batch 91 has covered and links to the class material. One of the group's admins has built a separate "PIAIC Management Portal" (a Next.js app on Vercel), and a classmate posted that learning-today.com would be even better with a management system of its own. The owner wants to build one, and wants it to be **better, not bigger**: simple, but in-depth enough that students actually engage.

The owner's own words that set the direction:

- "Guide what was discussed in this class, if any assignments were given or any homework given etc. Even if he is absent, he can follow it."
- "Keep it simple yet in-depth enough that students can engage. I don't want the kitchen sink thrown at it."
- "Right now I want this only for my batch."

### What "better" means here

The other portal (explored by the owner on 2026-11-23) is wide and shallow: about 60 pages, many of them placeholders ("Content pending official release"), invented data (a timetable with made-up rooms, test accounts in the student list, homework with no deadlines), broken filters (Pending and Completed homework swapped), a layout that breaks on phones, and three separate, empty discussion areas. It has **nothing about what happened in each real class**.

This portal wins by being about the class that actually happened, with every page working and full of real content:

1. A catch-up guide for every real class.
2. An accurate "what do I owe?" dashboard.
3. One discussion space, tied to the classes.
4. A quick admin screen, so the owner can publish a class guide in minutes.
5. Built for phones first, because the batch lives in WhatsApp.

## Goals

- A Batch 91 student can sign up, log in, and in one screen see which classes they have reviewed, which homework is due, and what is overdue.
- A student who missed a class can open that class's guide and fully catch up: what was discussed, the material, the homework and its deadline.
- Students can mark a class as reviewed, mark homework done, and optionally hand in a link to what they made.
- Any member can start a discussion thread and reply. Each class guide has its own thread for questions.
- The owner can add or edit a class guide, homework and links from a form, with no code, and can remove posts or members.

## Non-goals (for this version)

Attendance check-in, timetable, calendar, certificates, showcase approval flow, study groups, profile photos, in-app notifications, emails other than password reset, search, quizzes, lesson content hosting or iframes, multiple batches. Any of these can be added later. It is better to add a feature later than to ship it empty.

## Anti-goals (it fails if...)

- Pages or sections exist with placeholder or invented content.
- Any filter, count or status is wrong (it must never say "0 pending" when work is pending).
- It is awkward to use on a phone.
- People outside the batch can read or post.
- Adding a class guide takes the owner more than a few minutes, or needs a code change.
- It changes or breaks the existing public site.

## Constraints

- **Cost: free.** Vercel Hobby plan and Supabase Free plan. The subdomain is free, because the owner already owns learning-today.com.
- **The existing static site stays as it is.** Its only changes are a "Log in / Join the batch" link in the header or menu, a short "Batch portal" mention on the home page, a privacy page update, and README/sitemap housekeeping. The portal is not added to `sitemap.xml`.
- **Privacy.** The site will now hold students' names, emails and posts. `privacy.html` must be updated before launch to say what the portal stores, where (Supabase, Vercel; Resend for reset emails), who can see it (batch members, the admin), and how to ask for removal. Students' emails are never shown to other students.
- **Same look.** The portal uses the same colours, fonts and light/dark modes as `theme.css` (grey and orange, Oswald headings, Inter text, square orange buttons), so it feels like one site.
- **No secrets in the repo.** Keys live in Vercel and Supabase environment settings. Only the Supabase URL and the public "anon" key may reach the browser.
- **The owner is not a developer.** Setup steps for Supabase, Vercel and DNS must be written as click-by-click instructions.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A.** Add plain HTML/JS pages to the existing static site, with Supabase for login and data | Shortest build, one codebase, identical look. But with no server code, every rule has to live in database policies, and it is harder to grow (emails, notifications, rate limits). | Not chosen |
| **B1.** Rebuild the whole site as a Next.js app | Most room to grow, but it reworks pages that already work (SEO, previews) for no gain to students. | Rejected |
| **B2.** A separate Next.js app at `portal.learning-today.com` (Vercel + Supabase). The existing site is untouched and links to it. | About 1.5–2× the build time of A, plus a Vercel account and one DNS record. In return, it has server-side code for admin actions and spam limits, and it is easy to extend later. | **Chosen by the owner** |
| **C.** Ready-made tools (hosted Discourse forum plus a tracker) | Least code, but two extra logins, a different look, no class guides tied to progress, and Discourse hosting is paid. | Rejected |

## Decided design

### Who can get in

- **Sign-up needs a batch join code.** The owner posts it in the class WhatsApp group. A sign-up with a wrong code is refused on the server. The owner can change the code from the admin screen at any time, and existing members are unaffected.
- **Sign-up form:** full name, email, password, join code. Email confirmation is **off**, because the join code is the gate. Supabase's built-in email only delivers to members of the project's own Supabase organisation, not to students.
- **Password reset (decided by the owner): automatic reset emails.** Students use "Forgot password?" and get a reset link by email. Supabase sends it through a free outside email service, set up as Supabase's custom SMTP. *(My call: Resend, whose free plan covers 3,000 emails a month and 100 a day, far more than a batch needs.)* Emails come from an address on learning-today.com, for example `no-reply@learning-today.com`, which needs Resend's DNS records added at the owner's DNS provider. The setup guide covers this click by click. *(My call: email confirmation stays off even with SMTP available, because the join code is the gate and it keeps sign-up to one step.)* As a fallback, admins can also generate a reset link for a member from Admin → Members.
- **Roles:** `student` and `admin`. The owner is the first admin, set by hand in Supabase during setup. Admins can promote another member to admin later.
- **Members only.** Every portal page except log-in, sign-up and password reset requires being signed in as an active member. A removed member cannot sign in or see anything.
- **Removing a member** *(my call)*: "Remove" locks the person out, but keeps their posts and hand-ins visible under their name, so threads still make sense. "Delete permanently" (for privacy requests) deletes the account, profile, reviews, statuses and hand-ins. Their posts stay, with the author shown as "Former member". The privacy page promises exactly this.

### Pages

All pages work at phone width first. Navigation is a simple top bar: Dashboard · Classes · Discussions, plus the user menu (Profile, Log out) and, for admins, Admin.

1. **Log in / Sign up / Reset password.**
2. **Dashboard** (home after login):
   - Greeting and an overall line: "4 of 6 classes reviewed · 2 homework due".
   - **Due next** and **Overdue** lists (homework not yet marked done, by deadline).
   - A list of classes, newest first, each showing *reviewed* or *not reviewed* and its homework status, linking to the guide.
   - The latest discussion threads (3–5).
3. **Classes list.** Every published class, newest first, with date, title, and the student's own status.
4. **Class guide** (one per class): this is the heart of the portal.
   - Class number, date, title.
   - **What was discussed:** a rich-text summary (headings, lists, links), written by the admin.
   - **Material:** a list of links (slides, book chapter, artifact), each with a label.
   - **Homework:** zero or more items, each with a title, instructions, a deadline, and whether a hand-in link is expected.
   - **Your checklist:** "I've reviewed this class" and, per homework item, "Done" plus an optional "Hand in a link" field (a URL plus an optional note). The student can edit or remove their hand-in.
   - **Classmates' work:** for each homework item, the links classmates have handed in (name and link). *(My call: visible to all members, for engagement and peer learning. It can easily be made admin-only.)*
   - **Questions about this class:** that class's discussion thread, shown inline, so questions sit right next to the guide.
5. **Discussions.** One list of all threads, newest activity first. Each thread is either general or linked to a class. Anyone can start a thread (title plus body). Thread pages show replies in time order with a reply box. Authors can edit or delete their own posts. Admins can delete any post or thread, and pin a thread to the top.
6. **Profile.** Name (editable), email (read-only), joined date, and your progress summary. Students see only their own email.
7. **Admin** (admins only):
   - **Classes:** create, edit, publish or unpublish, delete. The form has number, date, title, summary (a rich-text or Markdown editor with a live preview), material links and homework items. A draft is visible only to admins until published. Publishing a class automatically creates its "Questions about Class N" thread.
   - **Hand-ins overview:** per class and homework item, who has marked it done or handed in, and who hasn't.
   - **Members:** the list of members (name, email, joined, classes reviewed, homework done). Actions: remove (deactivate) or restore a member, make admin.
   - **Settings:** change the join code.

### Content: post formatting and safety

- Class summaries and posts are written in **Markdown**, rendered to safe HTML on the server (raw HTML stripped, links open in a new tab with `rel="noopener nofollow"`).
- Limits: thread titles up to 150 characters, posts up to 5,000. Simple rate limit: one member can create at most 10 posts per 10 minutes, enforced on the server.

### Data (logical model)

- **profiles:** user id, full name, role (`student` / `admin`), status (`active` / `removed`), joined at.
- **classes:** number, date, title, summary (Markdown), status (`draft` / `published`), created and updated at.
- **class_materials:** class, label, URL, order.
- **homework:** class, title, instructions (Markdown), deadline (date and time, Pakistan time), hand-in expected (yes/no), order.
- **class_reviews:** student, class, reviewed at. Unique per student and class.
- **homework_status:** student, homework, done at, hand-in URL (optional), note (optional). Unique per student and homework.
- **threads:** author, title, body, linked class (optional), pinned, created at, last activity at.
- **posts** (replies): thread, author, body, created and edited at.
- **settings:** join code (readable only by admins and by the server).

Supabase row-level security enforces the rules in the database as well, not only in the app: members read published content, students write only their own reviews, statuses and posts, and only admins write classes, homework, settings and other people's records.

### Times and deadlines

All dates are shown and entered in Pakistan time (Asia/Karachi).

*(My calls on status rules:)*
- **Due** means not done and the deadline has not passed (or there is no deadline). **Overdue** means not done and the deadline has passed. The two never overlap. The summary line shows both when overdue items exist, for example "2 due · 1 overdue".
- **Late joiners:** every published class counts toward "N of M classes reviewed", because catching up is the point. But homework whose deadline passed **before the student joined** is never shown as overdue. It appears as "Catch-up (optional)" instead, so a new member doesn't land on a wall of red.
- **Hand-in expected:** if a homework item expects a hand-in, it counts as done only once a link is handed in, so "Done" and the link are one action. If no hand-in is expected, a plain "Done" tick is enough. The admin overview therefore has two states per item: done or not done (with the link shown where there is one).
- Homework with no deadline is never overdue, and it is listed under "Due" after the dated items.

### Starting content

The six classes already listed on the home page (18 Oct to 22 Nov 2026) are pre-loaded as published guides, using the "Covered" text as the starting summary and the existing reference links as material. They have no homework, because none is recorded. The owner can then enrich each guide (fuller summaries, homework) from the admin screen. The home page's "Batch 91, so far" table stays as it is.

### Where the code lives and how it ships

- Code in this repo, in a `portal/` folder, on its own branch until approved. Vercel deploys that folder (its "Root Directory" setting) on every push to `main`. GitHub Pages will also publish the `portal/` source files as plain files. That is harmless, because there are no secrets in the repo, but `robots.txt` should disallow `/portal/`.
- Stack: Next.js (App Router, TypeScript), Supabase (Auth plus Postgres plus row-level security, via the official SSR helpers), plain CSS using the same tokens as `theme.css`. No UI framework.
- Database schema and policies are kept as SQL migration files in the repo, so the database can be recreated.
- The owner gets a step-by-step setup guide: create the Supabase project and run the migrations, make themselves admin, create the Vercel project from the repo, add the environment variables, add the `portal` CNAME record at their DNS provider, and create a Resend account, verify the domain (DNS records) and connect it to Supabase as custom SMTP.

## Left to the builder

- Exact component structure, file layout inside `portal/`, and library choices beyond those above (for example the Markdown renderer and sanitiser), keeping dependencies few.
- Visual details within the existing site's style.
- Testing approach (unit tests for rules such as overdue and status logic, row-level security tests, end-to-end checks of the main flows), and how to run them without the owner's live Supabase project.
- Exact rate-limit mechanics and error messages, written in plain language.
