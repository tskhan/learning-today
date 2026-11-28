import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../lib/parse-page.mjs";
import { searchText } from "../lib/model.mjs";
import { readRepo } from "./helpers.mjs";

const page = readRepo("student-websites.html");

test("parsePage reads the committed page", () => {
  const m = parsePage(page);
  assert.equal(m.cards.length, 177);
  assert.equal(m.cards.filter((c) => c.scores).length, 171);
  assert.equal(m.exportDate, "2026-11-23");
  assert.equal(m.firstPosted, "2026-10-20");
  assert.equal(m.lastPosted, "2026-11-23");
  const first = m.cards[0];
  assert.deepEqual(first.scores, { overall: 84, concept: 99, uniqueness: 72, design: 83, usability: 84 });
  assert.equal(first.kind, "Portfolio");
  assert.equal(first.color, "#0b6159");
  assert.equal(first.posted, "20 Oct");
  assert.equal(first.platform, "Lovable");
  assert.equal(first.url, "https://agentic-ai-answer-studio.lovable.app");
  assert.equal(m.cards.filter((c) => !c.embeddable).length, 12);
  assert.ok(m.cards.some((c) => c.offline && !c.scores));
  assert.equal(first.timesPosted, 1);
  assert.equal(m.cards.filter((c) => c.timesPosted > 1).length, 13);
});

test("searchText reproduces every card's data-q", () => {
  const decode = (x) => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const qs = [...page.matchAll(/<li class="site"[^>]*data-q="([^"]*)"/g)].map((x) => decode(x[1]));
  const m = parsePage(page);
  assert.equal(qs.length, m.cards.length);
  m.cards.forEach((c, i) => assert.equal(searchText(c), qs[i], c.url));
});
