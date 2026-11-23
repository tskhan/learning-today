# learning-today.com

A website for learning Claude, built around the **PIAIC Batch 91** class, in two parts:

- **learning-today.com**, a static site: a landing page with the course roadmap and class timeline, every link the class admins shared, a gallery of the websites students built, and a beginner's guide to making animated videos with Claude.
- **portal.learning-today.com**, the members-only **Batch 91 Portal**: students sign up with the batch join code, catch up on every class step by step, track their reading and homework, hand in work and ask questions in one discussion space. Admins publish class guides and manage members. The source is in [`portal/`](portal/), with its own [README](portal/README.md) and [setup guide](portal/SETUP.md).

**Live:** https://learning-today.com · https://portal.learning-today.com

> This is an independent learner site. PIAIC, Panaversity and Anthropic run the official programme, book and exams. This site only points to them and records what one class has covered. Check [piaic.org](https://www.piaic.org) for syllabus, fees and dates.

## What's been built

### The static site (frontend, GitHub Pages)

- **Five pages** sharing one theme (`theme.css`) and one script (`site.js`): light and dark mode, condensed Oswald headings, one orange accent, and a header that shows its links inline when they fit and folds them into a menu when they do not.
- **Header:** **Sign-in** is the first menu item, outlined in orange so it stands out, followed by the Class resources dropdown, Core documents, Learn Claude, Make Videos with Claude, PIAIC Batch 91 and Enrol with PIAIC. On wide screens the bar is centred over the page content: the logo starts where the content starts and the menu ends in line with the content's buttons.
- **Home page:** a hero with a typing demo, a pinned practice quiz, a **Batch 91 Portal** card right after the hero, the Batch 91 class timeline, five core documents with previews, a Learn Claude path, the five-quarter roadmap and Class resources.
- **Links shared in Class**, **Student websites** (177 sites with live previews, search, filters and automated ratings) and **Make Videos with Claude**, plus a privacy page that explains both the site and the portal.
- Motion-based scroll reveals and count-ups that respect reduced motion, WebP images with fallbacks, a sitemap, and `robots.txt` that keeps the portal source, `docs/` and the student gallery out of search.

### The Batch 91 Portal: frontend (Next.js on Vercel)

- **Sign-in pages:** log in, join the batch (with the join code), forgot password and reset password. On wide screens each has a large learning-today logo with a short intro on the left and the form on the right; phones stack them.
- **Dashboard:** a greeting with a one-line summary, overdue and due-next homework, optional catch-up homework for late joiners, the class list, and the latest discussions in a side column.
- **Classes:** every published class with Reviewed or Not reviewed and homework progress. A **Your progress** card beside the list shows reading and homework bars and what to do next.
- **Class guide:** what was discussed, the material, homework with deadlines and hand-in links, an "I've reviewed this class" checklist and classmates' work. The class's own question thread sits beside the guide on wide screens.
- **Discussions:** threads with reply counts, pinning, class badges and a side card of every class's question thread. Posts support Markdown, rendered on the server and sanitised; authors can edit or delete their own posts and admins can remove any.
- **Admin:** publish and edit class guides (with a Markdown preview), see who handed in what, manage members (make admin, remove and restore, send a one-time reset link, delete for good) and change the join code.
- Forms keep what you typed when something is refused. All dates are in Pakistan time. Pages use the full width with side columns on desktop and a single column on phones.

### The Batch 91 Portal: backend (Supabase)

- **Logins** through Supabase Auth. Open sign-up is off; people join only through the portal's form, which checks the join code on the server. After 10 wrong join codes from one network in 15 minutes, sign-up pauses there. As a backstop, every new account starts as removed, and only the join form activates it. Password-reset emails go out through Resend from `no-reply@learning-today.com`.
- **Postgres database** with nine tables: profiles, classes, class materials, homework, class reviews, homework status, threads, posts and settings.
- **Every rule is enforced in the database** as well as in the app:
  - Row-level security on every table, so only active members can read anything, students change only their own data and only admins publish.
  - Column-level grants that limit what can be written, and keep hand-in notes private to their author (classmates see only the link).
  - Triggers for the posting rate limit (10 posts in 10 minutes), required hand-in links, a question thread opened automatically for each published class (and closed when the class is deleted), thread activity, edit marks, and clearing ticks when a hand-in becomes required.
- **Server-only secret key:** the secret key never reaches the browser. Every response carries security headers, so the portal can't be framed by another site (clickjacking). Redirects after login are checked against open-redirect tricks. A pasted Supabase URL with extra path is tolerated, and sign-up errors show a short reference code so problems can be traced in the Vercel logs.
- **Tests:** unit tests for the logic, database tests for every rule and trigger against a local Supabase, and Playwright browser tests of every flow on desktop and phone. All three suites pass before a portal change is merged.

## The pages

| Page | What it is |
|---|---|
| [`index.html`](index.html) | Landing page. A path for learning Claude, the PIAIC Batch 91 course details and five-quarter roadmap, five core documents with previews, and links to the two pages below. |
| [`admin-links.html`](admin-links.html) | **Links shared in Class.** Every link the class admins posted in the Batch 91 group, each admin shown with a photo, with the story behind it from the chat and a description of the link itself. Repeated links are merged, important ones are starred, and the core course documents are labelled. It has download buttons for the Google Slides and Google Doc files, and a download for the practice CSV. |
| [`student-websites.html`](student-websites.html) | A gallery of the 177 websites students posted (127 on Lovable, 50 on other platforms) with live previews, search, filters, and automated ratings out of 100 for concept, uniqueness, design and usability. Not indexed by search engines. |
| [`make-videos-with-claude.html`](make-videos-with-claude.html) | **Make Videos with Claude.** A beginner's guide to making animated videos with Claude Code and Remotion skills: what to install, the one setup prompt, what to type for a first video, how the examples were built, tips and credits. Shows three example videos. |
| [`privacy.html`](privacy.html) | What the site collects, which other companies see a visit, and how to ask for a change or removal. |
| [Batch 91 Portal](https://portal.learning-today.com) | Members-only app for the batch: sign up with the join code, follow each class step by step, track and hand in homework, and ask questions in one discussion space. Admins publish class guides from a form. Source in `portal/`; it is a separate Next.js app on Vercel, not part of the static site. Linked as **Sign-in**, first in every page's menu, and from a card right after the home page hero. |

## Every file

| File | Purpose |
|---|---|
| `index.html` | The landing page (see above). |
| `admin-links.html` | The Links shared in Class page (see above). The file keeps its original name so existing links keep working. |
| `privacy.html` | The privacy page, linked from every page's footer. Says what the site collects (Google Analytics), which other companies see a visit (Google Fonts, the student site previews, outside links), and how to ask for a change or removal through GitHub issues. Update its date whenever the site's data use changes. |
| `student-websites.html` | The student websites gallery (see above). Large, because it holds all 177 cards and the five rankings. |
| `make-videos-with-claude.html` | The Make Videos with Claude guide (see above). |
| `theme.css` | The shared design theme used by every page: colour tokens for light and dark mode, the fonts, the header and navigation, buttons and the footer. Changing a colour here changes it everywhere. Each page links it as `theme.css?v=DATE` (and `site.js?v=DATE`); after changing either file, update that date on every page so browsers fetch the new copy instead of a cached one. |
| `site.js` | The one script every page shares, in two parts. **Header:** shows the header links inline when they fit and collapses them into a menu when they do not, and loads a small, self-hosted popover polyfill only in browsers that lack native support. **Motion effects:** below-the-fold sections rise into view as you scroll, the big numbers (home page and Links shared in Class) count up once, and the ranking bars on Student websites fill in. It uses [Motion](https://motion.dev) 14.14.0, which each page loads from jsDelivr in a script tag just before `site.js`. Content already on screen is never hidden, nothing animates with reduced motion turned on, everything shows normally if the CDN fails, and printing shows all content. The tag carries an `integrity` hash, so browsers refuse a copy that differs from Motion 14.14.0. To change the Motion version, edit that script tag on every page and replace the hash (sha384 of the new `dist/motion.js`). |
| `assets/logo.png` | The learning-today.com logo as a transparent image, shown in the header of every page on light backgrounds. |
| `assets/logo-dark.png` | The same logo with the navy recoloured cream, so it stays readable on dark backgrounds. The header switches to it automatically in dark mode. |
| `assets/logo.webp`, `assets/logo-dark.webp` | WebP copies of the two logos, about 40% smaller. Browsers that support WebP (nearly all) load these; the PNGs stay as the fallback. |
| `assets/previews/*.webp`, `assets/previews/*-640.webp` | WebP copies of each preview image at 960 px and 640 px wide. The home page lets the browser pick the size it needs; the JPGs below stay as the fallback. |
| `assets/icon-192.png` | Square 192 px icon: the book-and-arrow mark on a white tile. Used as a browser tab icon on high-resolution screens. |
| `favicon.ico` | The browser tab icon (16, 32 and 48 px versions of the same mark). |
| `apple-touch-icon.png` | 180 px icon used when the site is added to an iPhone or iPad home screen. |
| `assets/admins/zia-khan.jpg`, `hamzah-syed.jpg`, `aneeq-khatri.jpg` | Square portraits of three class admins, shown beside their names on the Links shared in Class page. Taken from official public pages: panaversity.org/team (Zia Khan, Hamza Syed) and aneeqkhatri.com (Aneeq Khatri). The other admins shown (imran82ali, gullamna920) have no verified public photo and get an initial instead. |
| `assets/previews/coursebook.jpg` | Preview image of the home page of the main coursebook, *The AI Agent Factory*, second edition. |
| `assets/previews/intro-slides.jpg` | Preview image of the first slide of the beginner introductory session, *Agentic AI Engineering*. |
| `assets/previews/class-quest.jpg` | Preview image of *AI Worker Quest*, the Chapter 1 game used in class. |
| `assets/previews/claude-2-practical.jpg` | Preview image of the *Claude & ChatGPT 2.0: the practical* class slides. |
| `assets/previews/coding-agents-practical.jpg` | Preview image of the *Build a website with a coding agent* class slides. |
| `assets/videos/claude-anim.mp4`, `learning-today-promo.mp4` | The two example videos on the Make Videos with Claude page, made with Claude Code and Remotion. Each has a `-poster.jpg` still shown before it plays. |
| `assets/videos/plants-photosynthesis.mp4` | The result video on the same page (how plants make food), with its `-poster.jpg`. |
| `assets/vendor/popover-polyfill-0.5.2.min.js` | The [popover polyfill](https://github.com/oddbird/popover-polyfill) (BSD-3-Clause, licence in `popover-polyfill-LICENSE.txt` beside it), loaded by `site.js` only in older browsers without native popovers. Served from this site instead of a CDN. |
| `files/shaadi-expenses-sheet1.csv` | A small practice spreadsheet an admin shared in class: 12 made-up wedding expense lines with deliberate traps (a repeated line, a cancelled booking, a lowercase event name, pending items) for a checking exercise. Offered as a download from the Links shared in Class page. |
| `CNAME` | Tells GitHub Pages to serve this repo at `learning-today.com`. Do not delete it. |
| `robots.txt` | Tells search engines to skip the student websites page, the `portal/` source and `docs/`, and where the sitemap is. |
| `sitemap.xml` | Lists the pages search engines should index (home, Links shared in Class, Make Videos with Claude and privacy). Update `lastmod` when a page changes, and add any new page here. |
| `.gitignore` | Keeps `.env` files (which hold keys) and `node_modules` out of the repository. |
| `.nojekyll` | Tells GitHub Pages to publish the files as they are, without running Jekyll. |
| `README.md` | This file. |
| `portal/` | The Batch 91 Portal app (Next.js + Supabase), deployed to Vercel with Root Directory `portal`. GitHub Pages also publishes these source files as plain files; that is harmless (no secrets) and `robots.txt` keeps them out of search. See [`portal/README.md`](portal/README.md). |
| `docs/` | Design and build plan for the portal (`docs/superpowers/`). Kept out of search by `robots.txt`. |

## Where the content comes from

- **Course details:** the PIAIC programme page ([piaic.org](https://www.piaic.org)) and the Panaversity exam page for PCAO-F.
- **Links shared in Class and the Batch 91 timeline:** an export of the class WhatsApp group (22 Nov 2026). Each link was matched to the conversation around it, and each document was opened and summarised.
- **Student websites:** links students posted in the same group (export of 23 Nov 2026), plus one site added on request that was shared outside it. Titles and descriptions come from each site's own public page.
- **Ratings:** each site was opened in headless Chrome at desktop and phone width and measured. The scores are **automated estimates, not a teacher's grade**. They read what a page does, not the effort or learning behind it.

The generator scripts are kept outside this repository because they work from the raw chat export. The pages here are the finished output.

## Privacy

The static site has no accounts. The Batch 91 Portal does: what it stores, where, and who can see it is explained in the portal section of [`privacy.html`](privacy.html#portal).

The raw chat export is **not** in this repository, and nothing from it that identifies a student is published: no phone numbers, no poster names, no emails. Phone numbers and emails that a student put on their own site are stripped from descriptions. Student names that appear are the ones those students put in their own public site titles.

## Running it locally

There is no build step and nothing to install. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

The only outside code is Motion, loaded from jsDelivr for the animations with an integrity hash so the browser refuses any changed copy. The popover polyfill that older browsers need is served from this site (`assets/vendor/`). Fonts (Oswald for headings, Inter for text) load from Google Fonts without blocking the first paint. Offline, the pages still work, just without animations or the web fonts. The student gallery shows live previews of each student's site, so it needs an internet connection.

## Hosting and domain

Hosted free on **GitHub Pages** from the `main` branch, root folder. DNS is at GoDaddy:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| CNAME | `www` | `tskhan.github.io` |

HTTPS is enforced, and the certificate renews itself. A push to `main` redeploys the site in about a minute.

## Design and technical notes

- One shared theme across every page: light grey grounds (near black in dark mode), charcoal ink, one orange accent, condensed uppercase Oswald headings and Inter text. Green marks student work.
- Light and dark mode follow the device setting, using `color-scheme` and `light-dark()` with a media-query fallback.
- The header uses a native popover for the narrow-screen menu. Links shared in Class and Student websites sit together under a Class resources dropdown (a `details` element), second in the menu after Sign-in. On wide screens the header row is padded so it lines up with the 1024px content column. All animation respects `prefers-reduced-motion`.
- Animation is layered: small CSS animations for the hero entrance, the hero's typing demo, the menu and the cards on Links shared in Class; Motion (in `site.js`) for scroll reveals, count-ups and ranking bars. The filterable card grid on Student websites is left unanimated so it never clashes with search and filters.
- Previews of the class documents are screenshots, so they do not update if the originals change.

## Credits

Course material belongs to its authors: *The AI Agent Factory* by Zia Khan and co-authors (Panaversity), and the class slides and game by the Batch 91 teachers. Student websites belong to the students who made them. Admin portraits belong to their owners and come from panaversity.org and aneeqkhatri.com.
