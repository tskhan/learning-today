# learning-today.com

A small static website for learning Claude, built around the **PIAIC Batch 91** class. It has a landing page, a document of every link the class admins posted, a gallery of the websites the students built, and a beginner's guide to making animated videos with Claude.

The members-only **Batch 91 Portal** (class catch-up guides, homework tracking and discussions) lives in [`portal/`](portal/) and is served separately at https://portal.learning-today.com. It has its own [README](portal/README.md) and [setup guide](portal/SETUP.md).

**Live site:** https://learning-today.com

> This is an independent learner site. PIAIC, Panaversity and Anthropic run the official programme, book and exams. This site only points to them and records what one class has covered. Check [piaic.org](https://www.piaic.org) for syllabus, fees and dates.

## The pages

| Page | What it is |
|---|---|
| [`index.html`](index.html) | Landing page. A path for learning Claude, the PIAIC Batch 91 course details and five-quarter roadmap, five core documents with previews, and links to the two pages below. |
| [`admin-links.html`](admin-links.html) | **Links shared in Class.** Every link the class admins posted in the Batch 91 group, each admin shown with a photo, with the story behind it from the chat and a description of the link itself. Repeated links are merged, important ones are starred, and the core course documents are labelled. It has download buttons for the Google Slides and Google Doc files, and a download for the practice CSV. |
| [`student-websites.html`](student-websites.html) | A gallery of the 167 websites students posted (126 on Lovable, 41 on other platforms) with live previews, search, filters, and automated ratings out of 100 for concept, uniqueness, design and usability. Not indexed by search engines. |
| [`make-videos-with-claude.html`](make-videos-with-claude.html) | **Make Videos with Claude.** A beginner's guide to making animated videos with Claude Code and Remotion skills: what to install, the one setup prompt, what to type for a first video, how the examples were built, tips and credits. Shows three example videos. |
| [`privacy.html`](privacy.html) | What the site collects, which other companies see a visit, and how to ask for a change or removal. |
| [Batch 91 Portal](https://portal.learning-today.com) | Members-only app for the batch: sign up with the join code, follow each class step by step, track and hand in homework, and ask questions in one discussion space. Admins publish class guides from a form. Source in `portal/`; it is a separate Next.js app on Vercel, not part of the static site. Linked as **Batch portal** in every page's menu and from a card in Class resources. |

## Every file

| File | Purpose |
|---|---|
| `index.html` | The landing page (see above). |
| `admin-links.html` | The Links shared in Class page (see above). The file keeps its original name so existing links keep working. |
| `privacy.html` | The privacy page, linked from every page's footer. Says what the site collects (Google Analytics), which other companies see a visit (Google Fonts, the student site previews, outside links), and how to ask for a change or removal through GitHub issues. Update its date whenever the site's data use changes. |
| `student-websites.html` | The student websites gallery (see above). Large, because it holds all 167 cards and the five rankings. |
| `make-videos-with-claude.html` | The Make Videos with Claude guide (see above). |
| `theme.css` | The shared design theme used by every page: colour tokens for light and dark mode, the fonts, the header and navigation, buttons and the footer. Changing a colour here changes it everywhere. Each page links it as `theme.css?v=DATE` (and `site.js?v=DATE`); after changing either file, update that date on every page so browsers fetch the new copy instead of a cached one. |
| `site.js` | The one script every page shares, in two parts. **Header:** shows the header links inline when they fit and collapses them into a menu when they do not, and loads a small popover polyfill only in browsers that lack native support. **Motion effects:** below-the-fold sections rise into view as you scroll, the big numbers (home page and Links shared in Class) count up once, and the ranking bars on Student websites fill in. It uses [Motion](https://motion.dev) 14.14.0, which each page loads from jsDelivr in a script tag just before `site.js`. Content already on screen is never hidden, nothing animates with reduced motion turned on, everything shows normally if the CDN fails, and printing shows all content. To change the Motion version, edit that script tag on every page. |
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
| `files/shaadi-expenses-sheet1.csv` | A small practice spreadsheet an admin shared in class: 12 made-up wedding expense lines with deliberate traps (a repeated line, a cancelled booking, a lowercase event name, pending items) for a checking exercise. Offered as a download from the Links shared in Class page. |
| `CNAME` | Tells GitHub Pages to serve this repo at `learning-today.com`. Do not delete it. |
| `robots.txt` | Tells search engines to skip the student websites page, the `portal/` source and `docs/`, and where the sitemap is. |
| `sitemap.xml` | Lists the pages search engines should index (home, Links shared in Class, Make Videos with Claude and privacy). Update `lastmod` when a page changes, and add any new page here. |
| `.nojekyll` | Tells GitHub Pages to publish the files as they are, without running Jekyll. |
| `README.md` | This file. |
| `portal/` | The Batch 91 Portal app (Next.js + Supabase), deployed to Vercel with Root Directory `portal`. GitHub Pages also publishes these source files as plain files; that is harmless (no secrets) and `robots.txt` keeps them out of search. See [`portal/README.md`](portal/README.md). |
| `docs/` | Design and build plan for the portal (`docs/superpowers/`). Kept out of search by `robots.txt`. |

## Where the content comes from

- **Course details:** the PIAIC programme page ([piaic.org](https://www.piaic.org)) and the Panaversity exam page for PCAO-F.
- **Links shared in Class and the Batch 91 timeline:** an export of the class WhatsApp group (22 Nov 2026). Each link was matched to the conversation around it, and each document was opened and summarised.
- **Student websites:** links students posted in the same group. Titles and descriptions come from each site's own public page.
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

The only outside code is loaded from CDNs: Motion from jsDelivr for the animations, and a popover polyfill from unpkg in older browsers. Fonts (Oswald for headings, Inter for text) load from Google Fonts without blocking the first paint. Offline, the pages still work, just without animations or the web fonts. The student gallery shows live previews of each student's site, so it needs an internet connection.

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
- The header uses a native popover for the narrow-screen menu. Links shared in Class and Student websites sit together under a Class resources dropdown (a `details` element) in the menu. All animation respects `prefers-reduced-motion`.
- Animation is layered: small CSS animations for the hero entrance, the hero's typing demo, the menu and the cards on Links shared in Class; Motion (in `site.js`) for scroll reveals, count-ups and ranking bars. The filterable card grid on Student websites is left unanimated so it never clashes with search and filters.
- Previews of the class documents are screenshots, so they do not update if the originals change.

## Credits

Course material belongs to its authors: *The AI Agent Factory* by Zia Khan and co-authors (Panaversity), and the class slides and game by the Batch 91 teachers. Student websites belong to the students who made them. Admin portraits belong to their owners and come from panaversity.org and aneeqkhatri.com.
