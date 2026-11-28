import { test } from "node:test";
import assert from "node:assert/strict";
import { curve, usabilityScore, designMeasuredScore, designScore, overallScore, needsJudging } from "../lib/score.mjs";
import { minhash } from "../lib/unique.mjs";

const view = (o = {}) => ({ lcpMs: 1500, overflow: false, smallTapFraction: 0, axeSerious: 0, errors: 0, failedRequests: 0,
  contrastFailures: 0, cls: 0, badImages: 0, fontFamilies: 2, ...o });
const raw = (d = {}, p = d) => ({ desktop: view(d), phone: view(p) });

test("curve is linear between best and worst, clamped and rounded", () => {
  assert.equal(curve(1500, 1500, 6000), 100);
  assert.equal(curve(6000, 1500, 6000), 0);
  assert.equal(curve(3750, 1500, 6000), 50);
  assert.equal(curve(900, 1500, 6000), 100);
  assert.equal(curve(9000, 1500, 6000), 0);
});

test("usability: a perfect page scores 100, and each part carries its weight", () => {
  assert.equal(usabilityScore(raw()), 100);
  assert.equal(usabilityScore(raw({ lcpMs: 6000 })), 70);            // speed is 30%
  assert.equal(usabilityScore(raw({ overflow: true })), 90);         // phone fit 25%: overflow costs 40 of 100
  assert.equal(usabilityScore(raw({ smallTapFraction: 1 })), 85);    // the other 60 of phone fit
  assert.equal(usabilityScore(raw({ axeSerious: 20 })), 75);         // accessibility 25%
  assert.equal(usabilityScore(raw({ errors: 2, failedRequests: 2 })), 80); // working 20%, floor 0
  assert.equal(usabilityScore(raw({ lcpMs: 6000 }, view())), 85);    // desktop and phone averaged
});

test("measured design: contrast 40%, layout shift 30%, images 15%, fonts 15%", () => {
  assert.equal(designMeasuredScore(raw()), 100);
  assert.equal(designMeasuredScore(raw({ contrastFailures: 30 })), 60);
  assert.equal(designMeasuredScore(raw({ cls: 0.5 })), 70);
  assert.equal(designMeasuredScore(raw({ badImages: 4 })), 85);
  assert.equal(designMeasuredScore(raw({ fontFamilies: 7 })), 85);
});

test("design and overall round half to even", () => {
  assert.equal(designScore(85, 84), 84);
  assert.equal(designScore(86, 85), 86);
  assert.equal(overallScore({ concept: 85, uniqueness: 84, design: 84, usability: 85 }), 84);
  assert.equal(overallScore({ concept: 86, uniqueness: 85, design: 85, usability: 86 }), 86);
});

test("needsJudging: new, unjudged, changed or rubric-changed sites only", () => {
  const fp = { minhash: minhash("a page about baking bread at home with simple steps"), dhash: "0000000000000000", outline: "h1,h2" };
  const saved = { fingerprint: fp, judged: { rubricVersion: 1 } };
  assert.equal(needsJudging(undefined, { fingerprint: fp }, 1), true);
  assert.equal(needsJudging({ ...saved, judged: null }, { fingerprint: fp }, 1), true);
  assert.equal(needsJudging(saved, { fingerprint: fp }, 1), false);
  assert.equal(needsJudging(saved, { fingerprint: fp }, 2), true);
  assert.equal(needsJudging(saved, { fingerprint: { ...fp, dhash: "0000000000001fff" } }, 1), true);  // 13 bits differ
  assert.equal(needsJudging(saved, { fingerprint: { ...fp, dhash: "0000000000000fff" } }, 1), false); // 12 bits
  assert.equal(needsJudging(saved, { fingerprint: { ...fp, minhash: minhash("a shop selling shoes and bags online in karachi") } }, 1), true);
  assert.equal(needsJudging({ ...saved, fingerprint: { minhash: "", dhash: "", outline: "" } }, { fingerprint: fp }, 1), true);
});
