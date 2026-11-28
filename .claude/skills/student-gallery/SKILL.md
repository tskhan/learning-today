---
name: student-gallery
description: Regenerate student-websites.html after a WhatsApp export: measure every site, judge the new or changed ones, build, check and open a pull request. Use when the owner says "regenerate the gallery" or has pushed a new data/gallery/links.json.
---

# Regenerate the student websites gallery

The generator lives in `tools/gallery/`; the rules the page must meet are in `docs/student-gallery.md`; the design is `docs/superpowers/specs/2026-11-28-student-gallery-generator-design.md`. **You** do the judging, by looking at screenshots: no script calls an AI service and no API key is used.

## 0. Before you start

- `data/gallery/links.json` must be up to date. The owner makes it on their PC with
  `node tools/gallery/extract.mjs "<WhatsApp export .txt>"` and pushes it. Never ask for the chat export and never commit it.
- This needs to reach students' sites (lovable.app, vercel.app, netlify.app, …). In a cloud session, check with `get_environment`; if those hosts are blocked, propose a personal environment with open internet access for this repository (the owner approves) and stop until it's in place. On the owner's PC it works as it is.

## 1. Measure

```bash
cd tools/gallery && npm ci
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node measure.mjs   # on a PC: npx playwright install chromium, then node measure.mjs
```

It writes `data/gallery/.run/measurements.json` and screenshots in `data/gallery/.shots/` (both git-ignored) and prints each site's status. If more than half come back `offline` with proxy errors, the environment can't reach the internet: go back to step 0.

## 2. Judge, in batches

```bash
node queue.mjs --batch 15
```

It lists the anchors (sites with agreed scores) and then up to 15 sites, each with a desktop and a phone screenshot path and a short text digest.

1. **Calibrate:** open every anchor's screenshots with the Read tool and keep their agreed scores in mind.
2. **Judge each listed site:** open both screenshots with the Read tool, read the digest, then score it with the rubric below.
3. Write the batch as a JSON list to a scratch file and record it:

```json
[{ "url": "https://example.lovable.app", "concept": 78, "designLook": 72, "kind": "Portfolio", "reason": "A clear portfolio with three real projects and a contact form." }]
```

```bash
node record.mjs /path/to/batch.json
```

A batch with any problem is refused whole; fix it and record again. Repeat `queue.mjs` → judge → `record.mjs` until the queue says nothing is left. After every 3 batches run `node build.mjs` and commit `data/gallery/scores.json`, so the progress survives if the session ends (judgments in `.run/` are not committed).

### The rubric (rubric version 1)

Judge what the site shows, not who made it. Scores are whole numbers 0–100.

**Concept:** is the purpose clear and specific, is there real content or a working feature (not placeholders), and does the idea go beyond a template?
- 90+: a specific, original idea, fully built
- 75–89: a clear purpose, complete, fairly standard
- 60–74: understandable but thin or partly placeholder
- 40–59: mostly a generic template
- below 40: unclear or mostly placeholder

**Design-look:** visual hierarchy, spacing, typography, imagery fit, consistency, polish on the phone.
- 90+: looks professionally designed
- 75–89: clean and consistent
- 60–74: fine, with visible rough edges
- below 60: cluttered, broken or unstyled

**Kind:** one of App or game, Business, Food & drink, Learning, Other, Portfolio, Real estate, Shop.

**Reason:** one sentence, at most 160 characters, specific and kind, about the site and never the person. `scores.json` is public: write it as if the student will read it.

Stay consistent with the anchors: a site clearly better than the 80 anchor scores above 80, and so on.

## 3. Build and check

```bash
node build.mjs
node ../check-student-gallery.mjs     # must print OK
npm test                              # PW_CHROMIUM_PATH=/opt/pw-browsers/chromium in a cloud session
```

`build.mjs` writes nothing unless the checker passes. It updates `student-websites.html`, `data/gallery/scores.json` and the Student websites counts in `index.html` and `README.md`, and prints a summary.

## 4. Pull request

Commit `student-websites.html`, `data/gallery/`, `index.html` and `README.md` (never `.run/` or `.shots/`) and open a PR into `main`. In its description, from build.mjs's summary:
- the new sites;
- sites whose overall moved by 5 or more (old → new);
- sites offline or unrated this run;
- for the first run under this method, the five anchors and their scores, for the owner to confirm.
