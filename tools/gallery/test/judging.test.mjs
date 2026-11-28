import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildQueue } from "../queue.mjs";
import { validateJudgments, recordJudgments } from "../record.mjs";
import { minhash } from "../lib/unique.mjs";

const fp = (t) => ({ minhash: minhash(t), dhash: "0000000000000000", outline: "h1" });
const ok = (t) => ({ status: "ok", title: t, fingerprint: fp(t), shots: { desktop: `${t}-d.png`, phone: `${t}-p.png` }, digest: { headings: [t], text: t } });
const measurements = { runAt: "2026-12-01", results: {
  "https://new.lovable.app": ok("a brand new site about cooking rice"),
  "https://same.lovable.app": ok("an unchanged portfolio site for a designer"),
  "https://down.lovable.app": { status: "offline" },
  "https://wall.lovable.app": { status: "blocked" },
} };
const scores = { methodVersion: 1, rubricVersion: 1, sites: {
  "https://same.lovable.app": { fingerprint: fp("an unchanged portfolio site for a designer"), judged: { rubricVersion: 1 } },
} };

test("the queue holds new or changed reachable sites only, minus ones judged this run", () => {
  assert.deepEqual(buildQueue(measurements, scores, 1).map((q) => q.url), ["https://new.lovable.app"]);
  assert.deepEqual(buildQueue(measurements, scores, 2).map((q) => q.url), ["https://new.lovable.app", "https://same.lovable.app"]);
  assert.deepEqual(buildQueue(measurements, scores, 1, { "https://new.lovable.app": {} }), []);
  const q = buildQueue(measurements, scores, 1)[0];
  assert.deepEqual(q.shots, { desktop: "a brand new site about cooking rice-d.png", phone: "a brand new site about cooking rice-p.png" });
});

const queue = [{ url: "https://a.lovable.app" }, { url: "https://b.lovable.app" }];
const good = (o = {}) => ({ url: "https://a.lovable.app", concept: 80, designLook: 75, kind: "Portfolio", reason: "A clear portfolio with real projects.", ...o });

test("validateJudgments refuses anything malformed", () => {
  assert.deepEqual(validateJudgments([good()], queue), []);
  const bad = [
    [good({ url: "https://elsewhere.app" }), /not in the queue/],
    [good({ concept: 101 }), /concept/],
    [good({ designLook: -1 }), /designLook/],
    [good({ concept: 80.5 }), /concept/],
    [good({ kind: "Blog" }), /kind/],
    [good({ reason: "" }), /reason/],
    [good({ reason: "x".repeat(161) }), /reason/],
  ];
  for (const [j, re] of bad) assert.match(validateJudgments([j], queue).join(" "), re, JSON.stringify(j));
  assert.match(validateJudgments([good(), good()], queue).join(" "), /twice/);
  assert.match(validateJudgments({}, queue).join(" "), /list/);
});

test("recordJudgments merges valid batches and leaves the file untouched on a bad one", () => {
  const run = mkdtempSync(path.join(tmpdir(), "gallery-run-"));
  writeFileSync(path.join(run, "queue.json"), JSON.stringify(queue));
  const file = (name, list) => { const f = path.join(run, name); writeFileSync(f, JSON.stringify(list)); return f; };
  assert.deepEqual(recordJudgments(file("b1.json", [good()]), run, { today: "2026-12-01", rubricVersion: 1 }), []);
  assert.deepEqual(recordJudgments(file("b2.json", [good({ url: "https://b.lovable.app", kind: "Shop" })]), run, { today: "2026-12-01", rubricVersion: 1 }), []);
  const saved = JSON.parse(readFileSync(path.join(run, "judgments.json"), "utf8"));
  assert.deepEqual(Object.keys(saved).sort(), ["https://a.lovable.app", "https://b.lovable.app"]);
  assert.deepEqual(saved["https://a.lovable.app"], { concept: 80, designLook: 75, kind: "Portfolio", reason: "A clear portfolio with real projects.", judgedAt: "2026-12-01", rubricVersion: 1 });
  const before = readFileSync(path.join(run, "judgments.json"), "utf8");
  const problems = recordJudgments(file("b3.json", [good({ concept: 999 })]), run, { today: "2026-12-01", rubricVersion: 1 });
  assert.ok(problems.length > 0);
  assert.equal(readFileSync(path.join(run, "judgments.json"), "utf8"), before);
  assert.ok(existsSync(path.join(run, "judgments.json")));
});
