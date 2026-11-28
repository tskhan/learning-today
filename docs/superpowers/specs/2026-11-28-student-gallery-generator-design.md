# Student websites gallery: an in-repo generator with hybrid scoring

Date: 28 November 2026. Status: draft for approval.

## Why

`student-websites.html` shows every website Batch 91 students posted in the class WhatsApp group (177 cards on 23 Nov 2026), with live previews, filters and four scores out of 100. Today it is made by scripts that live only on the owner's PC, next to the raw chat export. Those scripts aren't in the repo, nobody else can run them, and their scoring formulas can't be seen or checked.

The owner exports the chat every so often, and **each export means rebuilding the gallery**. The goal is a generator that lives in this repo, can be run from a Claude Code session in the cloud, never touches the chat export there, and gives scores that stay steady from one export to the next.

The owner chose the scoring approach (C below) and asked that the judging use **Claude Code's own tokens (the owner's Claude plan), not an API key**.

## Goals

- **Repeatable on every export.** One short local step, then "regenerate the gallery" in any Claude Code session (cloud or local) does the rest and opens a pull request.
- **Fair, explainable scores.** Each category has a written method. A site that hasn't changed keeps its score, and new sites are judged by the same method.
- **Privacy.** The chat export never leaves the owner's PC and is never committed. No phone numbers, emails or poster names reach the repo or the page.
- **The page keeps its look and its contract.** Same layout, same four categories, same overall rule. `docs/student-gallery.md` and `tools/check-student-gallery.mjs` still apply, and the checker must print `OK`.

## Non-goals

- No API key, and no Claude calls from GitHub Actions or any script.
- No change to the page's design, filters, previews or rankings tables beyond what the scoring needs.
- No scoring of effort or learning. The page already says the scores read what the site does, not the student.

## Anti-goals (failure even if it "works")

- Ranks that jump around between exports for sites nobody changed.
- Any chat content beyond public links and post dates in the repo.
- A run that needs hand-editing of the HTML afterwards.
- Judging so expensive in tokens that a normal export (a handful of new sites) takes more than one short session.

## Approaches considered

- **A. Measure only.** A browser measures speed, phone fit, accessibility, contrast and similarity to other sites. Free and exactly repeatable, but it can't judge whether an idea is good, and a polished but empty site scores well.
- **B. Claude judges everything.** Closest to human taste, but more tokens, and scores drift a little between runs.
- **C. Hybrid with saved scores (chosen).** Measure what can be measured, have Claude judge only the parts that need taste (Concept, and the look-and-feel half of Design), and save every score in the repo so unchanged sites keep theirs. It is the only option that is both steady across exports and able to judge ideas. The owner picked C, with judging done by the Claude Code session instead of an API.

## How a rebuild works (the owner's routine)

1. **On the owner's PC (about a minute):** export the WhatsApp chat as usual, then run
   `node tools/gallery/extract.mjs "<path to the export .txt>"`.
   It writes `data/gallery/links.json` and prints how many links are new. Commit and push it (or let the session do it).
   The script has no dependencies, reads the export only from the path given, and writes nothing else.
2. **In a Claude Code session:** say "regenerate the gallery". The session follows the project skill `.claude/skills/student-gallery/SKILL.md`:
   1. `node tools/gallery/measure.mjs` opens every site, measures it, takes screenshots and works out which sites are new or changed.
   2. The session looks at the screenshots of the new or changed sites only, scores Concept and Design-look against the rubric below, and writes the results to `data/gallery/judgments.json`.
   3. `node tools/gallery/build.mjs` combines everything, ranks, writes `student-websites.html`, updates the counts in `index.html` and `README.md`, and runs the checker.
   4. The session commits and opens a pull request that lists new sites, changed scores and sites that went offline.

**Where step 2 runs.** Visiting 177 student sites needs open internet access. A cloud session therefore needs a personal environment that can reach any website (proposed at the first run, with the owner approving it). A local Claude Code session on the owner's PC works as it is. The scripts are the same either way.

## Data files (committed, public)

- `data/gallery/links.json`: one entry per unique link: `url` (normalised: https, no tracking query, no trailing slash), `firstPosted` (date only), `lastPosted`. Nothing else from the chat. Links students later asked to remove are listed in `data/gallery/removed.json` (url plus a one-word reason) and skipped.
- `data/gallery/scores.json`: the saved state per url:
  - `fingerprint`: a hash of the page's visible text, plus a small perceptual hash of the desktop screenshot;
  - `measured`: the raw measurements and the measured sub-scores;
  - `judged`: `{ concept, designLook, category, reason, judgedAt, rubricVersion }`, where `reason` is one short sentence;
  - `title`, `description` (from the site's own page, with phone numbers and emails stripped), `platform`, `status` (`ok`, `offline`, `blocked`);
  - `methodVersion`.
- `data/gallery/anchors.json`: five reference sites with agreed Concept and Design-look scores, used to calibrate every judging batch (see Judging).

Screenshots are working files only: written to a git-ignored `data/gallery/.shots/` and never committed.

**These files are public.** The repository is public, and GitHub Pages serves it, so anyone can read `scores.json`, reasons included. Reasons are therefore written as if the student will read them: specific, kind and about the site, never about the person. `robots.txt` gets `Disallow: /data/` so search engines skip the folder.

**Starting point.** The first `links.json` is seeded from the current `student-websites.html` (its 177 links and "Posted" dates), so the first run doesn't need a new export.

## Scoring (methodVersion 1)

All four categories are 0–100. **Overall = plain average of the four, rounded half to even** (the existing contract). Ranks: competition ranks among rated sites (the existing contract).

### Usability (measured, 100%)

Measured at desktop (1280×800) and phone (390×844), averaged:

- **Speed, 30%:** time until the main content is visible (largest contentful paint), with a long splash or intro screen counting as waiting.
- **Phone fit, 25%:** no sideways scrolling, tap targets at least 40 px, readable text (at least 14 px for body text).
- **Accessibility, 25%:** serious and critical axe-core violations (missing alt text, unlabelled buttons and links, no page language, and so on), with fewer violations scoring higher.
- **Working, 20%:** no page errors, no failed main requests, and same-site links that go somewhere.

### Design (50% measured, 50% judged)

- **Measured half:** text contrast (axe color-contrast), layout jumps while loading (cumulative layout shift), no stretched or blurry images, and a sane number of font families and sizes.
- **Judged half (Design-look):** see Judging.

### Uniqueness (measured, 100%)

How different the site is from every other site in the gallery:

- **Text, 50%:** similarity of the visible text to the most similar other site (word shingles). Starter-template wording ("Welcome to your new app", default Lovable or Vercel template text) counts as fully similar.
- **Look, 30%:** perceptual-hash distance of the desktop screenshot to the nearest other site.
- **Structure, 20%:** similarity of the page's section structure (the sequence of headings and landmark elements) to the nearest other site.

Uniqueness is recomputed for every site on every run from the saved fingerprints, so it only moves when a near-copy joins or leaves the gallery.

### Concept (judged, 100%)

See Judging.

## Judging (by the Claude Code session)

For each new or changed site the session looks at two images: the desktop view (first screen plus one scroll, scaled to 800 px wide) and the phone first screen. It also reads a short text digest: title, description, headings and about 300 words of visible text. It then gives:

- **Concept (0–100):** is the purpose clear and specific, is there real content or a working feature (not placeholders), and does the idea go beyond a template?
  - 90+: a specific, original idea, fully built;
  - 75–89: a clear purpose, complete, fairly standard;
  - 60–74: understandable, but thin or partly placeholder;
  - 40–59: mostly a generic template;
  - below 40: unclear or mostly placeholder.
- **Design-look (0–100):** visual hierarchy, spacing, typography, how well the imagery fits, consistency, and polish on the phone.
  - 90+: looks professionally designed;
  - 75–89: clean and consistent;
  - 60–74: fine, but with visible rough edges;
  - below 60: cluttered, broken or unstyled.
- **Category:** one of the existing kinds of site: App or game, Business, Food & drink, Learning, Other, Portfolio, Real estate, Shop.
- **Reason:** one short, kind sentence, kept in `scores.json` (public, see Data files) and not shown on the page.

**Calibration and steadiness:**

- Every judging batch starts by looking at the five anchor sites, with their agreed scores, before judging new ones.
- Batches are about 15 sites, and judgments are written to disk after each batch, so a session can stop and resume.
- A site is re-judged only when it is new, its fingerprint changed beyond a threshold (visible text less than 85% similar, or a clearly different screenshot), or the rubric version changes.

**First run.** The first run judges all ~177 sites once under the new method, in batches (likely over two or three sessions). This makes every site's score come from one method. The page's scoring note says the method changed on that date.

## Offline and blocked sites

A site that doesn't load (or blocks automated visits) on this run:

- if it has saved scores from an earlier run and was reachable within the last 60 days, it keeps them and is marked `stale` internally;
- otherwise it is shown unrated, as today.

## The build

`build.mjs` renders `student-websites.html` from a template (`tools/gallery/template.html`), taken from the current page: its CSS, scripts, header and footer, with the shared parts identical to `index.html`, as the contract requires. It fills in:

- cards, grouped into Lovable and Other, with `data-i` in order;
- the counts, chips, platform bar, the five ranking tables and the footer date (the export date, taken from `links.json`).

It computes every number from the final card list in one place. It then updates the Student websites count in `index.html` and the counts in `README.md`, and runs `tools/check-student-gallery.mjs`, failing the run unless it prints `OK`.

## Code layout

- `tools/gallery/extract.mjs`: chat export → `links.json`. Pure Node, no dependencies. Reads both WhatsApp export formats (Android `24/11/2026, 21:05 - Name: text` and iPhone `[24/11/2026, 21:05:33] Name: text`, day-first or month-first, detected from the file). It keeps only links and dates. It has unit tests on a made-up sample chat (no real data in the repo). Its first real run is on the owner's PC, and it prints a summary (links found, new, removed) to check.
- `tools/gallery/measure.mjs`: Playwright plus axe-core. Uses the pre-installed Chromium in cloud sessions (`PW_CHROMIUM_PATH`). Runs four sites in parallel, with a 30-second limit per page.
- `tools/gallery/score.mjs`: pure functions (measured sub-scores, uniqueness, overall, ranks), unit-tested.
- `tools/gallery/build.mjs` and `template.html`.
- `tools/gallery/package.json`: its own small dependencies (`playwright`, `axe-core`), separate from the portal's.
- `.claude/skills/student-gallery/SKILL.md`: the step-by-step runbook a session follows, including the rubric, batching and the pull request description.
- `docs/student-gallery.md`: updated so that "the generator" means these files.

## Constraints

- Never commit the chat export, screenshots or anything with phone numbers, emails or poster names.
- GitHub Pages serves the site, so the generator only produces static HTML.
- The existing contract and checker stay authoritative, and the build must pass them.
- Project rules apply: `?v=` dates and README kept in step, and every change through a pull request.

## Left to the builder

- Exact curves that turn each measurement into 0–100 (for example, LCP 1.5 s → 100, 6 s → 0), within the weights above.
- The fingerprint threshold details, and how the 800 px judging images are cropped.
- Choosing the five anchor sites (spread across the scale, from the current gallery) and proposing their scores for the owner to confirm in the first pull request.
- How the template is extracted from the current page, and the wording of the pull request summary.

## Calls made by Claude (the owner may change any of these)

- Re-judge all sites once under the new method instead of keeping today's scores. This means one consistent method; ranks will shift once.
- Keep the four category names so the page and checker barely change; Design becomes half measured, half judged.
- Offline sites keep recent scores for 60 days.
- Judging reasons are kept in `scores.json`, written kindly because that file is public, and not shown on the page.
- The first `links.json` is seeded from the current page, so building and testing can start before the next export.
- A cloud run needs a personal environment with open internet access, approved by the owner at the first run.
