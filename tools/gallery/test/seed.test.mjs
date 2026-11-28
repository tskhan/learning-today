import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../seed.mjs";
import { normaliseUrl } from "../lib/model.mjs";
import { readRepo } from "./helpers.mjs";

const { links, scores } = seed(readRepo("student-websites.html"));

test("seed lists every link once, with full dates", () => {
  assert.equal(links.exportDate, "2026-11-23");
  assert.equal(links.links.length, 177);
  assert.equal(new Set(links.links.map((l) => l.url)).size, 177);
  const first = links.links.find((l) => l.url === "https://agentic-ai-answer-studio.lovable.app");
  assert.deepEqual(first, { url: "https://agentic-ai-answer-studio.lovable.app", firstPosted: "2026-10-20", lastPosted: "2026-10-20", times: 1 });
  assert.equal(links.links.filter((l) => l.times > 1).length, 13);
  for (const l of links.links) assert.equal(normaliseUrl(l.url), l.url);
});

test("seed keeps today's scores as legacy, with nothing judged yet", () => {
  const s = scores.sites["https://agentic-ai-answer-studio.lovable.app"];
  assert.equal(s.methodVersion, 0);
  assert.deepEqual(s.legacy, { overall: 84, concept: 99, uniqueness: 72, design: 83, usability: 84, kind: "Portfolio" });
  assert.equal(s.judged, null);
  assert.equal(s.color, "#0b6159");
  assert.equal(Object.keys(scores.sites).length, 177);
  assert.equal(Object.values(scores.sites).filter((x) => x.status === "offline").length, 6);
});

test("seed output has no phone numbers or emails", () => {
  const all = JSON.stringify({ links, scores }).replace(/\d{4}-\d{2}-\d{2}/g, "DATE");
  assert.doesNotMatch(all, /\+?\d[\d\s-]{8,}\d/);
  assert.doesNotMatch(all, /[\w.+-]+@[\w-]+\.[\w.]+/);
});
