import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../lib/parse-page.mjs";
import { renderPage } from "../lib/render.mjs";
import { checkGallery } from "../../check-student-gallery.mjs";
import { readRepo } from "./helpers.mjs";

const page = readRepo("student-websites.html");
const template = readRepo("tools/gallery/template.html");

test("render(parse(page)) reproduces the committed page byte for byte", () => {
  const out = renderPage(parsePage(page), template);
  if (out !== page) {
    let i = 0;
    while (out[i] === page[i]) i++;
    assert.fail(`differs at ${i}:\n  page: ${JSON.stringify(page.slice(i - 80, i + 120))}\n  out:  ${JSON.stringify(out.slice(i - 80, i + 120))}`);
  }
});

test("ranks and counts come from the cards", () => {
  const model = parsePage(page);
  model.cards = model.cards.slice(120, 135); // both sections, some unrated
  const out = renderPage(model, template);
  assert.deepEqual(checkGallery({ gallery: out }).problems, []);
});

test("long titles and descriptions are cut for display but searchable in full", () => {
  const model = parsePage(page);
  const card = { ...model.cards[0], title: "T".repeat(100), description: "D".repeat(200), q: undefined };
  model.cards = [card];
  const out = renderPage(model, template);
  assert.match(out, new RegExp(`<h3>${"T".repeat(80)}</h3><p>${"D".repeat(150)}</p>`));
  assert.match(out, new RegExp(`data-q="${"t".repeat(100)} ${"d".repeat(200)} `));
});
