# Student Gallery Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `student-websites.html` from a privacy-safe link list with in-repo scripts: measured scores plus Claude-session judgments, saved so unchanged sites keep their scores between exports.

**Architecture:** Plain Node ES modules in `tools/gallery/`. The data lives in `data/gallery/*.json` (committed). The pipeline has five steps:
1. `extract` turns the chat export into links (on the owner's PC);
2. `measure` uses Playwright and axe-core to write a run file, with screenshots in a git-ignored folder;
3. `queue` and `record` let the Claude session judge the new or changed sites;
4. `build` merges everything into `scores.json` and renders the page from `template.html`;
5. the existing checker must print `OK`.

A golden test keeps the renderer honest: `render(parse(page))` must equal the committed page byte for byte.

**Tech Stack:** Node 22 (ES modules, `node:test`), Playwright (Chromium, via `PW_CHROMIUM_PATH` where pre-installed), axe-core, and no other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-28-student-gallery-generator-design.md`

## Global Constraints

- Never commit the chat export, screenshots (`data/gallery/.shots/`), run files (`data/gallery/.run/`), phone numbers, emails or poster names.
- `docs/student-gallery.md` and `tools/check-student-gallery.mjs` stay authoritative: every build ends by running the checker and fails unless it prints `OK`.
- Overall = plain average of the four categories, **rounded half to even** (reuse `roundHalfEven` from `tools/check-student-gallery.mjs`). Ranks are competition ranks among rated sites (reuse `competitionRanks`).
- Weights (methodVersion 1):
  - Usability = speed 30% + phone fit 25% + accessibility 25% + working 20%, from desktop 1280×800 and phone 390×844, averaged.
  - Design = 50% measured + 50% judged Design-look.
  - Uniqueness = text 50% + look 30% + structure 20%.
  - Concept = 100% judged.
- Re-judge only when: the site is new; its text similarity is below **0.85** or its screenshot hash distance is above **12 of 64 bits**; or `rubricVersion` changed.
- An offline or blocked site keeps its saved scores if it was last reachable within **60 days**; otherwise it shows unrated.
- Kinds of site (exact strings): `App or game`, `Business`, `Food & drink`, `Learning`, `Other`, `Portfolio`, `Real estate`, `Shop`.
- `data/gallery/*.json` is public (served by GitHub Pages). Judging reasons must be kind and about the site. `robots.txt` gets `Disallow: /data/`.
- The scripts must not call any AI service. Judging is done by the Claude Code session following `.claude/skills/student-gallery/SKILL.md`.
- Shared page parts (header logo, `theme.css` and `site.js` tags) stay identical to `index.html` (the checker enforces it).

## Review Focus

1. **A WhatsApp export in the other format** (iPhone `[dd/mm/yyyy, hh:mm:ss]`, or month-first dates) yields the same links and dates as the Android format. Test in Task 4.
2. **The same site posted twice in different forms** (http vs https, trailing slash, `?utm_…`, `www.`) becomes one card with the earliest date. Test in Task 4.
3. **A site that hangs, redirects to a login page or throws on load** must not stop the run. It is recorded `offline` or `blocked` and the run continues. Test in Task 6.
4. **A judgment file with a missing site, an out-of-range score or an unknown kind of site** is refused with a clear message, and nothing is half-merged. Test in Task 7.
5. **A re-run with no new links and nothing changed** produces a page byte-identical to the last one, apart from the export date. Test in Task 8.

---

## File structure

| File | Responsibility |
|---|---|
| `tools/gallery/package.json` | Own deps (`playwright`, `axe-core`), `"type": "module"`, scripts `test`, `measure`, `build` |
| `tools/gallery/lib/model.mjs` | Shared helpers: `normaliseUrl`, `platformOf`, `colorOf`, `PALETTE`, `KINDS`, `searchText` |
| `tools/gallery/lib/parse-page.mjs` | Current page → page model (bootstrap and golden test only) |
| `tools/gallery/lib/render.mjs` + `tools/gallery/template.html` | Page model → HTML |
| `tools/gallery/extract.mjs` | Chat export → `data/gallery/links.json` (owner's PC) |
| `tools/gallery/seed.mjs` | One-off: current page → `links.json` + `scores.json` (methodVersion 0) |
| `tools/gallery/lib/score.mjs` | Pure measured sub-scores, Design/overall combination, `needsJudging` |
| `tools/gallery/lib/unique.mjs` | MinHash, dHash distance, outline similarity, uniqueness |
| `tools/gallery/measure.mjs` | Visit every link, write `data/gallery/.run/measurements.json` and `.shots/` |
| `tools/gallery/queue.mjs`, `tools/gallery/record.mjs` | Judging support for the Claude session |
| `tools/gallery/build.mjs` | Merge run + judgments into `scores.json`, render, update index/README counts, run checker |
| `tools/gallery/test/*.test.mjs` + `test/fixtures/` | `node --test` suites, made-up chat, tiny local fixture sites |
| `data/gallery/links.json`, `scores.json`, `anchors.json`, `removed.json` | Committed state |
| `.claude/skills/student-gallery/SKILL.md` | Runbook and rubric |

### Shared data shapes (every task uses these names)

```js
// links.json
{ exportDate: "2026-11-23", links: [{ url, firstPosted: "2026-10-20", lastPosted }] }
// scores.json
{ methodVersion: 1, rubricVersion: 1, sites: { [url]: SiteState } }
SiteState = {
  title, description, host, platform, color, embeddable,       // display
  status: "ok" | "offline" | "blocked", lastOkAt,               // "YYYY-MM-DD"
  fingerprint: { minhash: string /* 64×8 hex */, dhash: string /* 16 hex */, outline: string },
  measured: { usability, designMeasured, raw: { lcpMs, cls, phoneFit, axeSerious, errors, ... } },
  judged: { concept, designLook, kind, reason, judgedAt, rubricVersion } | null,
  legacy?: { overall, concept, uniqueness, design, usability, kind }  // from seed only
}
// page model (input to render)
PageModel = { exportDate, firstPosted, lastPosted, cards: Card[] }
Card = { url, host, title, description, platform, kind, color, embeddable, posted /* "20 Oct" */,
         offline: boolean, scores: { overall, concept, uniqueness, design, usability } | null }
```

---

### Task 1: Package, shared helpers and the page parser

**Files:**
- Create: `tools/gallery/package.json`, `tools/gallery/lib/model.mjs`, `tools/gallery/lib/parse-page.mjs`
- Test: `tools/gallery/test/model.test.mjs`, `tools/gallery/test/parse-page.test.mjs`
- Modify: `.gitignore` (add `data/gallery/.shots/`, `data/gallery/.run/`), `robots.txt` (add `Disallow: /data/`)

**Interfaces:**
- Produces, in `lib/model.mjs`:
  - `normaliseUrl(url: string): string`
  - `platformOf(url: string): string`
  - `PALETTE: string[]` and `colorOf(host: string): string`
  - `KINDS: string[]`
  - `searchText(card: Card): string`
- Produces, in `lib/parse-page.mjs`: `parsePage(html: string): PageModel`

- [ ] **Step 1: Write the failing tests**

```js
test("normaliseUrl folds variants of one site", () => {
  for (const u of ["http://x.lovable.app", "https://x.lovable.app/", "https://x.lovable.app/?utm_source=wa", "https://www.x.lovable.app"])
    assert.equal(normaliseUrl(u), "https://x.lovable.app");
  assert.equal(normaliseUrl("https://a.vercel.app/about/"), "https://a.vercel.app/about");
});
test("platformOf follows the gallery's hosts", () => {
  const cases = { "https://a.lovable.app": "Lovable", "https://a.netlify.app": "Netlify", "https://a.vercel.app": "Vercel",
    "https://a.base44.app": "Base44", "https://u.github.io/p": "GitHub Pages", "https://a.freebuff.app": "Freebuff",
    "https://a.bolt.host": "Bolt", "https://share.google/abc": "Google link", "https://vibenplay.fun": "Custom domain" };
  for (const [u, p] of Object.entries(cases)) assert.equal(platformOf(u), p);
});
test("colorOf is stable and from the palette", () => {
  assert.equal(PALETTE.length, 9);
  assert.equal(colorOf("a.lovable.app"), colorOf("a.lovable.app"));
  assert.ok(PALETTE.includes(colorOf("b.vercel.app")));
});
test("parsePage reads the committed page", () => {
  const m = parsePage(readFileSync("student-websites.html", "utf8"));
  assert.equal(m.cards.length, 177);
  assert.equal(m.cards.filter((c) => c.scores).length, 171);
  assert.equal(m.exportDate, "2026-11-23");
  const first = m.cards[0];
  assert.deepEqual(first.scores, { overall: 84, concept: 99, uniqueness: 72, design: 83, usability: 84 });
  assert.equal(first.kind, "Portfolio"); assert.equal(first.color, "#0b6159"); assert.equal(first.posted, "20 Oct");
  assert.equal(m.cards.filter((c) => !c.embeddable).length, 12);
});
```

- [ ] **Step 2: Run** `cd tools/gallery && npm install && node --test test/` and **expect FAIL** (modules missing).

- [ ] **Step 3: Implement.**
  - `PALETTE` = `["#8f1033","#2c3a4d","#1a6447","#365510","#0b6159","#a03a08","#6e2610","#7a5000","#0c5079"]`.
  - `colorOf` = `PALETTE[fnv1a32(host) % 9]` (used only for new sites; seeded sites keep their colour).
  - Google link hosts: `share.google`, `sites.google.com`.
  - `searchText` must reproduce the page's `data-q` exactly: the golden test in Task 2 pins it.
  - `parsePage` reads the cards and their data attributes, the footer export date, and the lede's date range.

- [ ] **Step 4: Run** `node --test test/` and **expect PASS**.
- [ ] **Step 5: Commit** "Gallery generator: shared helpers and page parser".

### Task 2: Template and renderer (golden round trip)

**Files:**
- Create: `tools/gallery/template.html`, `tools/gallery/lib/render.mjs`
- Test: `tools/gallery/test/render.test.mjs`

**Interfaces:**
- Consumes: `parsePage`, `searchText`, `competitionRanks`, `roundHalfEven` (checker).
- Produces: `renderPage(model: PageModel, template: string): string`.

- [ ] **Step 1: Write the failing test**

```js
test("render(parse(page)) reproduces the committed page byte for byte", () => {
  const html = readFileSync("student-websites.html", "utf8");
  assert.equal(renderPage(parsePage(html), readFileSync("tools/gallery/template.html", "utf8")), html);
});
test("ranks and counts come from the cards", () => {
  const model = parsePage(readFileSync("student-websites.html", "utf8"));
  model.cards = model.cards.slice(0, 5);
  const out = renderPage(model, readFileSync("tools/gallery/template.html", "utf8"));
  const { problems } = checkGallery({ gallery: out });
  assert.deepEqual(problems, []);
});
```

- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Make `template.html` and `renderPage`.**
  - `template.html` is the current page with each generated region replaced by a marker: `<!--G:lede-->`, `<!--G:split-->`, `<!--G:chips-->`, `<!--G:lovable-->`, `<!--G:other-->`, `<!--G:rank-overall-->` and the other four rank markers, `<!--G:method-count-->`, `<!--G:footer-date-->`. Every other byte is copied verbatim.
  - `renderPage` fills the markers following the rules in `docs/student-gallery.md`: first 20 table rows `rk`, the rest `rk more`; the platform-bar width to two decimals; and so on.
- [ ] **Step 4: Run and expect PASS** (both tests), then `node tools/check-student-gallery.mjs` → `OK`.
- [ ] **Step 5: Commit** "Gallery generator: template and renderer".

### Task 3: Seed the data files from the current page

**Files:**
- Create: `tools/gallery/seed.mjs`, `data/gallery/links.json`, `data/gallery/scores.json`, `data/gallery/removed.json` (`[]`), `data/gallery/anchors.json` (`[]`)
- Test: `tools/gallery/test/seed.test.mjs`

**Interfaces:**
- Consumes: `parsePage`, `normaliseUrl`.
- Produces: `seed(html: string): { links, scores }` and a CLI that writes both files.
  - Every seeded site is `methodVersion 0`, with `legacy` filled, `judged: null` and `fingerprint` empty strings.
  - Dates are full ISO (`20 Oct` → `2026-10-20`, using the lede's year range).

- [ ] **Step 1: Write the failing test.** Assert:
  - `seed(page).links.links.length === 177`;
  - the first link's `firstPosted === "2026-10-20"`;
  - `scores.sites[url].legacy.overall === 84` for the first card;
  - no value in either output matches `/\+?\d[\d\s-]{8,}\d|@[\w-]+\./` (no phone numbers or emails).
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement**, then run `node tools/gallery/seed.mjs` to write the files.
- [ ] **Step 4: Run** `node --test tools/gallery/test/` and **expect PASS**.
- [ ] **Step 5: Commit** "Gallery generator: seed data from the current page" (data files included).

### Task 4: Chat export → links

**Files:**
- Create: `tools/gallery/extract.mjs`, `tools/gallery/test/fixtures/chat-android.txt`, `tools/gallery/test/fixtures/chat-iphone.txt` (made-up names, fake numbers such as `+92 300 0000000`, example links)
- Test: `tools/gallery/test/extract.test.mjs`

**Interfaces:**
- Consumes: `normaliseUrl`, existing `links.json`, `removed.json`.
- Produces:
  - `parseChat(text: string): Array<{ url, date }>`
  - `mergeLinks(existing, found, removed): { links, added: string[] }`
  - a CLI: `node tools/gallery/extract.mjs <export.txt> [--export-date YYYY-MM-DD]`. It writes `links.json` and prints `found N, new M, skipped (removed) K`.

- [ ] **Step 1: Write the failing tests.**
  - Both fixture formats give identical `[{url, date}]` lists.
  - The month-first fixture (`11/24/26, 9:05 PM - …`) gives the same dates.
  - Duplicate forms collapse to one link with the earliest `firstPosted` and latest `lastPosted`.
  - Links in `removed.json` are skipped.
  - Non-site links are ignored (`chat.whatsapp.com`, `wa.me`, `youtube.com`, `youtu.be`, `docs.google.com`, `drive.google.com`, `forms.gle`, `meet.google.com`, `piaic.org`, `panaversity.org`).
  - The output never contains a name, phone number or message text from the fixture: assert the serialised JSON has no fixture name and no `+92`.
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement.**
  - Detect day-first vs month-first from the first line with a date part over 12. Default to day-first.
  - `--export-date` defaults to the last message's date.
  - The real-site rule: any http(s) link not on the ignore list above. The extract step doesn't need a "posted by a student" signal: the owner reviews the `new` list it prints.
- [ ] **Step 4: Run and expect PASS.**
- [ ] **Step 5: Commit** "Gallery generator: chat export to links".

### Task 5: Pure scoring and uniqueness

**Files:**
- Create: `tools/gallery/lib/score.mjs`, `tools/gallery/lib/unique.mjs`
- Test: `tools/gallery/test/score.test.mjs`, `tools/gallery/test/unique.test.mjs`

**Interfaces:**
- Produces, in `score.mjs`:
  - `curve(value, best, worst): number` (linear, clamped 0–100, rounded)
  - `usabilityScore(raw): number`
  - `designMeasuredScore(raw): number`
  - `designScore(measured, look): number` (`roundHalfEven((measured + look) / 2)`)
  - `overallScore(s): number`
  - `needsJudging(saved: SiteState | undefined, fresh, rubricVersion): boolean`
- Produces, in `unique.mjs`:
  - `minhash(text): string`, `textSimilarity(a, b): number` (0–1)
  - `hamming(dhashA, dhashB): number`
  - `outlineSimilarity(a, b): number` (0–1)
  - `uniquenessScores(sites: Record<url, {minhash, dhash, outline, starter: boolean}>): Record<url, number>`

- [ ] **Step 1: Write the failing tests, with these pinned values.**
  - Speed: `curve(lcp, 1500, 6000)`, so 1500 ms → 100, 6000 ms → 0, 3750 ms → 50.
  - Phone fit: no sideways scroll is worth 40; small tap targets fraction f is worth `60 × (1 − f)`.
  - Accessibility: `curve(axeSerious, 0, 20)`.
  - Working: 100 − 25 per page error or failed main request, floor 0.
  - Each Usability part is averaged over desktop and phone, then weighted 30/25/25/20.
  - Design measured: contrast `curve(contrastFailures, 0, 30)` 40%, CLS `curve(cls, 0.05, 0.5)` 30%, images not stretched or blurry 15%, font families ≤ 3 15%.
  - `overallScore({concept:85, uniqueness:84, design:84, usability:85}) === 84` (84.5 → 84).
  - `needsJudging`:
    - true for an unknown url, for `textSimilarity < 0.85`, for `hamming > 12`, and when `judged.rubricVersion !== rubricVersion`;
    - true when `judged === null` (seeded sites);
    - false otherwise.
  - Uniqueness:
    - two identical sites both get text part 0;
    - a site with `starter: true` gets text part 0;
    - a site unlike all others scores ≥ 90;
    - the score is `roundHalfEven(0.5·text + 0.3·look + 0.2·structure)`, where `text = 100·(1 − maxSim)`, `look = 100·min(1, minHamming / 24)` and `structure = 100·(1 − maxOutlineSim)`.
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement.**
  - MinHash: 64 seeded FNV-1a hashes over word 3-shingles of lower-cased, whitespace-collapsed text.
  - `outlineSimilarity`: longest common subsequence length divided by the longer length, over comma-separated outline tokens.
- [ ] **Step 4: Run and expect PASS.**
- [ ] **Step 5: Commit** "Gallery generator: scoring and uniqueness".

### Task 6: Measuring sites

**Files:**
- Create: `tools/gallery/measure.mjs`, `tools/gallery/test/fixtures/sites/{good,slow,broken,starter}/index.html`
- Test: `tools/gallery/test/measure.test.mjs` (serves the fixtures with `node:http` on a random port)

**Interfaces:**
- Consumes: `links.json`, `scores.json`, `usabilityScore`, `designMeasuredScore`, `minhash`.
- Produces:
  - `measureSite(browser, url, { shotsDir, timeoutMs = 30000 }): Promise<Measurement>`
  - a CLI that writes `data/gallery/.run/measurements.json` as `{ runAt, results: { [url]: Measurement } }`.

  ```js
  Measurement = {
    status, title, description, embeddable,
    fingerprint: { minhash, dhash, outline },
    starter,
    measured: { usability, designMeasured, raw },
    digest: { headings: string[], text: string /* ≤ 300 words */ },
    shots: { desktop, phone },
  }
  ```

- [ ] **Step 1: Write the failing test.** Measure the four fixture sites:
  - `good` scores usability ≥ 85 and `status: "ok"`;
  - `slow` (serves the body after 4 s) scores lower speed than `good`;
  - `broken` (throws on load and has an image without alt) scores lower on working and accessibility;
  - `starter` (contains "Welcome to your new app") has `starter: true`;
  - a url to a closed port returns `status: "offline"` within `timeoutMs`, without throwing;
  - `description` has any phone number or email removed (put one in `good`'s meta description);
  - both shot files exist, and the desktop shot is 800 px wide.
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement.**
  - Chromium launch: `executablePath: process.env.PW_CHROMIUM_PATH` when set.
  - LCP and CLS: via `PerformanceObserver` from an init script.
  - axe-core: inject `require.resolve("axe-core/axe.min.js")`; count `serious` and `critical` violations. Contrast failures come from the `color-contrast` rule.
  - `embeddable` = false when `X-Frame-Options` is DENY or SAMEORIGIN, or the CSP `frame-ancestors` doesn't allow `*`.
  - dHash: compute in the page from the screenshot on a canvas (9×8 grayscale), so no image library is needed.
  - Desktop judging shot: 1280×1600 at deviceScaleFactor 0.625 → 800×1000.
  - Run four sites at once.
  - `blocked` = the page loaded but it is a login wall, or the HTTP status is ≥ 400.
- [ ] **Step 4: Run and expect PASS.**
- [ ] **Step 5: Commit** "Gallery generator: measuring sites".

### Task 7: Judging support

**Files:**
- Create: `tools/gallery/queue.mjs`, `tools/gallery/record.mjs`
- Test: `tools/gallery/test/judging.test.mjs`

**Interfaces:**
- Consumes: `measurements.json`, `scores.json`, `needsJudging`, `KINDS`, `anchors.json`.
- Produces:
  - `buildQueue(measurements, scores, rubricVersion): Array<{ url, shots, digest }>`.
  - CLI `node tools/gallery/queue.mjs [--batch 15]` prints the next batch as Markdown: anchors first, then each site's image paths and digest. It also writes `data/gallery/.run/queue.json`.
  - `validateJudgments(list, queue): string[]` returns problems.
  - `recordJudgments(file): void` merges into `data/gallery/.run/judgments.json` only when validation passes, and stamps `judgedAt` and `rubricVersion`.

- [ ] **Step 1: Write the failing tests.** `validateJudgments` refuses:
  - a url not in the queue;
  - `concept: 101` or `-1`;
  - a non-integer score;
  - `kind: "Blog"`;
  - an empty reason;
  - a reason over 160 characters.

  Also:
  - a valid batch merges, and a second valid batch adds to the first;
  - a failing batch leaves `judgments.json` byte-identical;
  - `buildQueue` leaves out sites whose `needsJudging` is false and sites that are `offline` or `blocked`.
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement.** The judgment entry shape is `{ url, concept, designLook, kind, reason }`.
- [ ] **Step 4: Run and expect PASS.**
- [ ] **Step 5: Commit** "Gallery generator: judging queue and recording".

### Task 8: Build

**Files:**
- Create: `tools/gallery/build.mjs`
- Test: `tools/gallery/test/build.test.mjs` (works on temp copies of the repo files)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `mergeState(scores, measurements, judgments, today): scores` (pure).
  - `toPageModel(scores, links): PageModel` (pure).
  - CLI `node tools/gallery/build.mjs` writes `scores.json` and `student-websites.html`, updates the counts in `index.html` and `README.md` (the patterns the checker reads), then runs `checkGallery`. It exits 1 with the problems if any.

- [ ] **Step 1: Write the failing tests.**
  - Unchanged site: a fresh measurement with the same fingerprint keeps `measured` and `judged` as saved. Its scores don't move even if the raw speed differs.
  - Changed site: a new judgment replaces the old, and the new measurement is used.
  - Offline: offline 30 days after `lastOkAt` keeps its scores; offline 61 days after shows unrated (`scores: null`, `offline: true`).
  - Seeded sites: a seeded `methodVersion 0` site with no judgment yet uses its `legacy` scores, so a part-finished first run still builds.
  - Uniqueness is recomputed across all sites with a fingerprint.
  - Kind: `judged.kind` falls back to `legacy.kind`, then `Other`.
  - Re-run: running `toPageModel` and `renderPage` twice with no changes gives identical HTML.
  - Checker: the build output passes `checkGallery` with `index` and `readme`.
- [ ] **Step 2: Run and expect FAIL.**
- [ ] **Step 3: Implement.**
  - Card order: `firstPosted`, then url.
  - `posted` = `firstPosted` formatted `D Mon`.
  - The lede range is the earliest to the latest `firstPosted`.
  - The footer date is `links.exportDate`, formatted `D Mon YYYY`.
- [ ] **Step 4: Run and expect PASS**, plus the golden test from Task 2 and the checker.
- [ ] **Step 5: Commit** "Gallery generator: build".

### Task 9: Runbook, docs and project wiring

**Files:**
- Create: `.claude/skills/student-gallery/SKILL.md`
- Modify: `docs/student-gallery.md` (the generator is now `tools/gallery/`; routine; data files; first-run note), `README.md` (files table and gallery description), `CLAUDE.md` (Student websites section points to the skill), `portal/tests/unit/student-gallery.test.ts` (add one vitest case that imports `renderPage` and `parsePage` and asserts the golden round trip, so the portal's `npm test` also guards the renderer; the full gallery suite stays `cd tools/gallery && npm test`).

**Interfaces:** consumes all the CLIs, exactly as named above.

- [ ] **Step 1: Write SKILL.md.** Frontmatter: `name: student-gallery`, `description: Regenerate student-websites.html after a WhatsApp export: measure, judge new or changed sites, build, check, open a PR.` Body:
  1. Preconditions: `links.json` is pushed, and network access can reach student sites. If `measure` reports most sites offline with proxy errors, stop and say the environment needs open internet access.
  2. `cd tools/gallery && npm ci`.
  3. `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node measure.mjs` (drop the variable on a PC).
  4. The loop: `node queue.mjs --batch 15` → view each listed image with the Read tool → write the batch's judgments JSON → `node record.mjs <file>` → repeat until the queue is empty. `judgments.json` lives in the git-ignored `.run/`, so after every 3 batches run `node build.mjs` and commit `scores.json`: that saves the progress if the session ends.
  5. The rubric, copied verbatim from the spec's "Judging" section, with the anchors procedure.
  6. `node build.mjs`, `node tools/check-student-gallery.mjs` → `OK`, then the PR body: new sites, sites whose overall moved by ≥ 5, sites now offline or unrated.
- [ ] **Step 2: Add the vitest golden case**, run `cd portal && npm run test:unit` and **expect PASS**.
- [ ] **Step 3: Update the docs.** Check that the README file list mentions every new file and folder.
- [ ] **Step 4: Commit** "Gallery generator: runbook and docs".

### Task 10: First full run (operational, after Tasks 1–9 are merged)

- [ ] **Step 1:** In a cloud session, call `get_environment`. If student hosts are blocked, propose a personal environment with open internet access for this repository (the owner approves). Alternatively, run on the owner's PC.
- [ ] **Step 2:** Run `measure.mjs` on all links. Pick five anchor sites spread across today's overall scores (around 90, 80, 70, 60, 45) and write `anchors.json` with proposed Concept and Design-look scores and a reason each.
- [ ] **Step 3:** Judge all sites in batches (over several sessions if needed), building and committing `scores.json` every 3 batches.
- [ ] **Step 4:** Update the template text for the new method:
  - the four ranking blurbs, describing what each category now measures;
  - the method section: name the measured and judged parts, and add "The scoring method changed on <date>; earlier ranks aren't comparable."
- [ ] **Step 5:** `node build.mjs` → checker `OK`. Commit the page, template and data. Open the PR listing the anchors for the owner to confirm and the biggest rank changes.

---

## Self-review notes

- **Spec coverage:**
  - Routine: Tasks 4 and 9.
  - Data files and public notice: Tasks 1, 3 and 9.
  - Scoring weights: Task 5.
  - Judging rubric, batches and anchors: Tasks 7, 9 and 10.
  - Re-judge rules and offline rule: Tasks 5 and 8.
  - Build and counts: Task 8.
  - First run and method note: Task 10.
  - No-API rule: Global Constraints and Task 9.
- **Starter-template text:** Task 6 (`starter`) feeds Task 5 (text part 0).
- **Names and types:** the names used across tasks match the shared data shapes above.
