import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseUrl, platformOf, PALETTE, colorOf, KINDS } from "../lib/model.mjs";

test("normaliseUrl folds variants of one site", () => {
  for (const u of ["http://x.lovable.app", "https://x.lovable.app/", "https://x.lovable.app/?utm_source=wa", "https://www.x.lovable.app"])
    assert.equal(normaliseUrl(u), "https://x.lovable.app");
  assert.equal(normaliseUrl("https://a.vercel.app/about/"), "https://a.vercel.app/about");
});

test("platformOf follows the gallery's hosts", () => {
  const cases = {
    "https://a.lovable.app": "Lovable", "https://a.netlify.app": "Netlify", "https://a.vercel.app": "Vercel",
    "https://a.base44.app": "Base44", "https://u.github.io/p": "GitHub Pages", "https://a.freebuff.app": "Freebuff",
    "https://a.bolt.host": "Bolt", "https://share.google/abc": "Google link", "https://vibenplay.fun": "Custom domain",
  };
  for (const [u, p] of Object.entries(cases)) assert.equal(platformOf(u), p, u);
});

test("colorOf is stable and from the palette", () => {
  assert.equal(PALETTE.length, 9);
  assert.equal(colorOf("a.lovable.app"), colorOf("a.lovable.app"));
  assert.ok(PALETTE.includes(colorOf("b.vercel.app")));
});

test("KINDS are the gallery's kinds of site", () => {
  assert.deepEqual(KINDS, ["App or game", "Business", "Food & drink", "Learning", "Other", "Portfolio", "Real estate", "Shop"]);
});
