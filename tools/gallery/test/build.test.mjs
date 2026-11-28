import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeState, toPageModel, buildAll, titleFromHost } from "../build.mjs";
import { renderPage } from "../lib/render.mjs";
import { minhash } from "../lib/unique.mjs";
import { readRepo } from "./helpers.mjs";

const TEXT = "a family bakery in karachi selling fresh sourdough rye and seeded loaves every morning";
const fp = (t = TEXT, dhash = "00ff00ff00ff00ff") => ({ minhash: minhash(t), dhash, outline: "header,h1,section,footer" });
const raw = { desktop: {}, phone: {} };
const site = (o = {}) => ({
  methodVersion: 1, title: "Green Leaf", description: "Bakery", host: "leaf.lovable.app", platform: "Lovable", color: "#0b6159",
  embeddable: true, status: "ok", lastOkAt: "2026-11-01", fingerprint: fp(), starter: false,
  measured: { usability: 80, designMeasured: 70, raw }, judged: { concept: 82, designLook: 76, kind: "Food & drink", reason: "Clear.", judgedAt: "2026-11-01", rubricVersion: 1 }, ...o,
});
const fresh = (o = {}) => ({ status: "ok", title: "Green Leaf", description: "Bakery", embeddable: true, fingerprint: fp(), starter: false,
  measured: { usability: 60, designMeasured: 40, raw }, digest: { headings: [], text: "" }, shots: {}, ...o });
const URL1 = "https://leaf.lovable.app";
const scoresWith = (s) => ({ methodVersion: 1, rubricVersion: 1, sites: { [URL1]: s } });
const runOf = (m) => ({ runAt: "2026-12-01", results: { [URL1]: m } });
const links = { exportDate: "2026-12-01", links: [{ url: URL1, firstPosted: "2026-10-20", lastPosted: "2026-10-22", times: 2 }] };

test("an unchanged site keeps its saved measurements and judgment, even if the raw numbers moved", () => {
  const out = mergeState(scoresWith(site()), runOf(fresh()), {}, "2026-12-01");
  assert.equal(out.sites[URL1].measured.usability, 80);
  assert.equal(out.sites[URL1].judged.concept, 82);
  assert.equal(out.sites[URL1].lastOkAt, "2026-12-01");
});

test("a changed site takes the new measurement and the new judgment", () => {
  const changed = fresh({ fingerprint: fp("a shoe shop with handmade leather shoes and bags online", "ff00ff00ff00ff00") });
  const judgments = { [URL1]: { concept: 60, designLook: 50, kind: "Shop", reason: "A simple shop.", judgedAt: "2026-12-01", rubricVersion: 1 } };
  const out = mergeState(scoresWith(site()), runOf(changed), judgments, "2026-12-01");
  assert.equal(out.sites[URL1].measured.usability, 60);
  assert.equal(out.sites[URL1].judged.kind, "Shop");
  assert.equal(out.sites[URL1].fingerprint.dhash, "ff00ff00ff00ff00");
});

test("offline sites keep recent scores for 60 days, then show unrated", () => {
  const card = (lastOkAt) => toPageModel(mergeState(scoresWith(site({ lastOkAt })), runOf({ status: "offline" }), {}, "2026-12-31"), links, "2026-12-31").cards[0];
  const recent = card("2026-12-01"); // 30 days
  assert.ok(recent.scores);
  assert.equal(recent.offline, true);
  const old = card("2026-10-31"); // 61 days
  assert.equal(old.scores, null);
  assert.equal(old.offline, true);
});

test("seeded sites with no judgment yet use their legacy scores", () => {
  const seeded = site({ methodVersion: 0, measured: null, judged: null, fingerprint: { minhash: "", dhash: "", outline: "" },
    legacy: { overall: 77, concept: 80, uniqueness: 70, design: 78, usability: 80, kind: "Business" } });
  const c = toPageModel(scoresWith(seeded), links).cards[0];
  assert.deepEqual(c.scores, { overall: 77, concept: 80, uniqueness: 70, design: 78, usability: 80 });
  assert.equal(c.kind, "Business");
});

test("new-method scores: concept judged, design half and half, uniqueness across the gallery, overall averaged", () => {
  const two = { methodVersion: 1, rubricVersion: 1, sites: {
    [URL1]: site(),
    "https://copy.lovable.app": site({ host: "copy.lovable.app" }),
  } };
  const model = toPageModel(two, { exportDate: "2026-12-01", links: [...links.links, { url: "https://copy.lovable.app", firstPosted: "2026-10-21", lastPosted: "2026-10-21", times: 1 }] });
  const c = model.cards[0];
  assert.equal(c.scores.concept, 82);
  assert.equal(c.scores.design, 73);       // (70 + 76) / 2
  assert.equal(c.scores.usability, 80);
  assert.equal(c.scores.uniqueness, 0);    // an exact copy of the other site
  assert.equal(c.scores.overall, 59);      // (82 + 0 + 73 + 80) / 4 = 58.75
  assert.equal(c.kind, "Food & drink");
  assert.equal(c.posted, "20 Oct");
  assert.equal(c.timesPosted, 2);
  assert.equal(model.exportDate, "2026-12-01");
});

test("a new site that never loaded gets a title from its address", () => {
  assert.equal(titleFromHost("id-preview--9ef2cf37-6def.lovable.app"), "Id Preview 9ef2cf37 6def");
  const out = mergeState({ methodVersion: 1, rubricVersion: 1, sites: {} }, runOf({ status: "offline" }), {}, "2026-12-01");
  const c = toPageModel(out, links).cards[0];
  assert.equal(c.title, "Leaf");
  assert.equal(c.scores, null);
});

test("building from the seeded data reproduces today's page and passes the checker with index and README", () => {
  const out = buildAll({
    links: JSON.parse(readRepo("data/gallery/links.json")), scores: JSON.parse(readRepo("data/gallery/scores.json")),
    measurements: null, judgments: {}, template: readRepo("tools/gallery/template.html"),
    index: readRepo("index.html"), readme: readRepo("README.md"), previous: readRepo("student-websites.html"), today: "2026-12-01",
  });
  assert.deepEqual(out.problems, []);
  assert.equal(out.html, readRepo("student-websites.html"));
  assert.equal(out.index, readRepo("index.html"));
  assert.equal(out.readme, readRepo("README.md"));
});

test("building twice with nothing new gives identical output", () => {
  const scores = mergeState(scoresWith(site()), runOf(fresh()), {}, "2026-12-01");
  const t = readRepo("tools/gallery/template.html");
  assert.equal(renderPage(toPageModel(scores, links), t), renderPage(toPageModel(mergeState(scores, runOf(fresh()), {}, "2026-12-01"), links), t));
});

test("a changed site stays queued for judging even after a build runs before it is judged", async () => {
  const { buildQueue } = await import("../queue.mjs");
  const changed = fresh({ fingerprint: fp("a shoe shop with handmade leather shoes and bags online", "ff00ff00ff00ff00") });
  const run = runOf(changed);
  const before = scoresWith(site());
  assert.deepEqual(buildQueue(run, before, 1).map((q) => q.url), [URL1]);
  const afterBuild = mergeState(before, run, {}, "2026-12-01");
  assert.deepEqual(buildQueue(run, afterBuild, 1).map((q) => q.url), [URL1]);
  const judged = mergeState(afterBuild, run, { [URL1]: { concept: 60, designLook: 50, kind: "Shop", reason: "A simple shop.", judgedAt: "2026-12-01", rubricVersion: 1 } }, "2026-12-01");
  assert.deepEqual(buildQueue(run, judged, 1), []);
});

test("a removed link leaves scores.json and no longer counts in others' uniqueness", () => {
  const scores = { methodVersion: 1, rubricVersion: 1, sites: {
    [URL1]: site(),
    "https://gone.lovable.app": site({ host: "gone.lovable.app", title: "Gone" }),
  } };
  const out = buildAll({
    links, scores, measurements: null, judgments: {}, template: readRepo("tools/gallery/template.html"),
    index: '<p class="big" aria-hidden="true">1</p>\n<h3>Student websites</h3>', readme: "", previous: null, today: "2026-12-01",
  });
  assert.deepEqual(Object.keys(out.scores.sites), [URL1]);
  assert.doesNotMatch(JSON.stringify(out.scores), /gone\.lovable\.app/);
  assert.ok(toPageModel(scores, links).cards[0].scores.uniqueness > 50, "uniqueness counts only cards on the page");
});

test("the summary compares against the page saved when measuring started, not a mid-run build", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { previousPage } = await import("../build.mjs");
  const dir = mkdtempSync(join(tmpdir(), "gallery-data-"));
  assert.equal(previousPage(dir, "<on disk>"), "<on disk>");
  mkdirSync(join(dir, ".run"));
  writeFileSync(join(dir, ".run/baseline.html"), "<published>");
  assert.equal(previousPage(dir, "<on disk>"), "<published>");
});
