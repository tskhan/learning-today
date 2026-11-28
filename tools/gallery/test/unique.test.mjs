import { test } from "node:test";
import assert from "node:assert/strict";
import { minhash, textSimilarity, hamming, outlineSimilarity, uniquenessScores } from "../lib/unique.mjs";

const A = "learn to bake sourdough bread at home with our step by step guide and video lessons for beginners";
const B = "buy handmade leather shoes and bags online with free delivery across karachi lahore and islamabad";

test("minhash similarity: identical texts 1, unrelated texts near 0, small edits stay high", () => {
  assert.equal(minhash(A).length, 64 * 8);
  assert.equal(textSimilarity(minhash(A), minhash(A)), 1);
  assert.ok(textSimilarity(minhash(A), minhash(B)) < 0.1);
  assert.ok(textSimilarity(minhash(A), minhash(A.replace("beginners", "everyone"))) > 0.7);
});

test("hamming counts differing bits of two 64-bit hashes", () => {
  assert.equal(hamming("0000000000000000", "0000000000000000"), 0);
  assert.equal(hamming("0000000000000000", "000000000000000f"), 4);
  assert.equal(hamming("ffffffffffffffff", "0000000000000000"), 64);
});

test("outline similarity is the longest common run over the longer outline", () => {
  assert.equal(outlineSimilarity("h1,nav,h2,h2,footer", "h1,nav,h2,h2,footer"), 1);
  assert.equal(outlineSimilarity("h1,h2,h2,footer", "h1,h2,footer,form"), 0.75);
  assert.equal(outlineSimilarity("", ""), 1);
});

test("uniqueness: copies score low, starter templates lose the text part, a one-off scores high", () => {
  const sites = {
    copy1: { minhash: minhash(A), dhash: "0000000000000000", outline: "h1,h2,h2,footer", starter: false },
    copy2: { minhash: minhash(A), dhash: "0000000000000000", outline: "h1,h2,h2,footer", starter: false },
    starter: { minhash: minhash("welcome to your new app start building"), dhash: "ffff0000ffff0000", outline: "h1,p", starter: true },
    oneOff: { minhash: minhash(B), dhash: "ffffffffffffffff", outline: "nav,section,form,aside,table,footer", starter: false },
  };
  const u = uniquenessScores(sites);
  assert.equal(u.copy1, 0);
  assert.equal(u.copy2, 0);
  assert.ok(u.starter <= 50, `starter ${u.starter}`);
  assert.ok(u.oneOff >= 90, `oneOff ${u.oneOff}`);
});
