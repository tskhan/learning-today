#!/usr/bin/env node
/**
 * Checks that student-websites.html (and the count on index.html and README.md) is internally
 * consistent, following the rules in docs/student-gallery.md. Run it after regenerating the
 * gallery, from the repository root:
 *
 *   node tools/check-student-gallery.mjs
 *
 * It prints "OK" and exits 0, or lists every problem and exits 1. No dependencies.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CATS = ["concept", "uniqueness", "design", "usability"];
const ALL = ["overall", ...CATS];
const TOP_ROWS = 20; // rows shown before "Show all" in each ranking table

/** Round half to even, like Python's round(): 84.5 → 84, 85.5 → 86. */
export function roundHalfEven(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (Math.abs(diff - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

/** Competition ranking ("1224"): 1 + the number of scores strictly higher. */
export function competitionRanks(scores) {
  return scores.map((x) => 1 + scores.filter((o) => o > x).length);
}

const decode = (s) => s.replace(/&amp;/g, "&");

/** Returns a list of problems (empty when everything is consistent) and a short summary. */
export function checkGallery({ gallery, index = null, readme = null }) {
  const problems = [];
  const fail = (msg) => problems.push(msg);

  // ---- cards -------------------------------------------------------------------------------
  const cards = [...gallery.matchAll(/<li class="site"[\s\S]*?<\/li>/g)].map((m) => {
    const li = m[0];
    const attr = (name) => li.match(new RegExp(`data-${name}="([^"]*)"`))?.[1] ?? null;
    const scores = Object.fromEntries(ALL.map((k) => [k, attr(k) === null ? null : Number(attr(k))]));
    return {
      li,
      href: li.match(/href="([^"]*)"/)?.[1] ?? "?",
      plat: attr("plat"),
      cat: attr("cat") === null ? null : decode(attr("cat")),
      i: attr("i") === null ? null : Number(attr("i")),
      scores,
      rated: ALL.every((k) => scores[k] !== null),
      partly: ALL.some((k) => scores[k] !== null) && !ALL.every((k) => scores[k] !== null),
      rankLine: li.match(/Overall rank <b>#(\d+)<\/b> of (\d+)/),
      badge: li.match(/title="Overall rating (\d+) out of 100, rank (\d+) of (\d+)"/),
      four: [...li.matchAll(/<span>(Concept|Uniqueness|Design|Usability) <b>(\d+)<\/b>/g)].map((x) => Number(x[2])),
    };
  });
  const total = cards.length;
  const rated = cards.filter((c) => c.rated);
  const R = rated.length;
  if (total === 0) return { problems: ["No cards found (<li class=\"site\" …>)."], summary: "" };

  const seenHrefs = new Set();
  for (const c of cards) {
    if (seenHrefs.has(c.href)) fail(`Duplicate card for ${c.href}.`);
    seenHrefs.add(c.href);
    if (c.partly) fail(`${c.href} has some score attributes but not all five.`);
    if (!c.rated) {
      if (c.rankLine || c.badge) fail(`${c.href} is unrated but shows a rank.`);
      continue;
    }
    if (c.four.join() !== CATS.map((k) => c.scores[k]).join()) fail(`${c.href}: the four scores shown (${c.four}) differ from its data attributes.`);
    const mean = CATS.reduce((n, k) => n + c.scores[k], 0) / 4;
    if (roundHalfEven(mean) !== c.scores.overall) fail(`${c.href}: overall ${c.scores.overall} isn't the average of the four (${mean}, rounded half to even = ${roundHalfEven(mean)}).`);
  }

  // ---- ranks: among the rated cards on the page only ---------------------------------------
  const ranks = Object.fromEntries(ALL.map((k) => {
    const r = competitionRanks(rated.map((c) => c.scores[k]));
    return [k, new Map(rated.map((c, n) => [c.href, r[n]]))];
  }));
  for (const c of rated) {
    const want = ranks.overall.get(c.href);
    if (!c.rankLine) fail(`${c.href}: no "Overall rank #N of M" line.`);
    else if (Number(c.rankLine[1]) !== want || Number(c.rankLine[2]) !== R) fail(`${c.href}: says rank #${c.rankLine[1]} of ${c.rankLine[2]}, should be #${want} of ${R}.`);
    if (!c.badge) fail(`${c.href}: no score badge title.`);
    else if (Number(c.badge[1]) !== c.scores.overall || Number(c.badge[2]) !== want || Number(c.badge[3]) !== R) {
      fail(`${c.href}: badge says "${c.badge[0].slice(7, -1)}", should be "Overall rating ${c.scores.overall} out of 100, rank ${want} of ${R}".`);
    }
  }

  // ---- the five ranking tables -------------------------------------------------------------
  for (const k of ALL) {
    const sec = gallery.match(new RegExp(`<section[^>]*id="rank-${k}"[\\s\\S]*?</section>`))?.[0];
    if (!sec) { fail(`Ranking table #rank-${k} is missing.`); continue; }
    const head = sec.match(/<span>(\d+) rated sites<\/span>/);
    if (!head || Number(head[1]) !== R) fail(`#rank-${k} header says "${head?.[1] ?? "?"} rated sites", should be ${R}.`);
    const rows = [...sec.matchAll(/<li class="(rk(?: more)?)"><span class="pos">#(\d+)<\/span><a class="nm" href="([^"]*)"[\s\S]*?<b class="num">(\d+)<\/b>/g)]
      .map((m) => ({ cls: m[1], pos: Number(m[2]), href: m[3], num: Number(m[4]) }));
    if (rows.length !== R) fail(`#rank-${k} lists ${rows.length} sites, should list all ${R} rated sites.`);
    const listed = new Set(rows.map((r) => r.href));
    for (const c of rated) if (!listed.has(c.href)) fail(`#rank-${k} is missing ${c.href}.`);
    rows.forEach((r, n) => {
      const card = rated.find((c) => c.href === r.href);
      if (!card) { fail(`#rank-${k} lists ${r.href}, which has no rated card.`); return; }
      if (r.num !== card.scores[k]) fail(`#rank-${k}: ${r.href} shows ${r.num}, its card says ${card.scores[k]}.`);
      if (r.pos !== ranks[k].get(r.href)) fail(`#rank-${k}: ${r.href} is #${r.pos}, should be #${ranks[k].get(r.href)}.`);
      if (n > 0 && r.num > rows[n - 1].num) fail(`#rank-${k}: not sorted by score at ${r.href}.`);
      const wantCls = n < TOP_ROWS ? "rk" : "rk more";
      if (r.cls !== wantCls) fail(`#rank-${k}: row ${n + 1} has class "${r.cls}", should be "${wantCls}".`);
    });
  }
  const best = gallery.match(/Rank 1 is the best of (\d+) rated sites/);
  if (!best || Number(best[1]) !== R) fail(`"How it was scored" should say "Rank 1 is the best of ${R} rated sites" (says ${best?.[1] ?? "nothing"}).`);

  // ---- counts --------------------------------------------------------------------------------
  const lede = gallery.match(/class="lede"><b>(\d+) websites<\/b>/);
  if (!lede || Number(lede[1]) !== total) fail(`Intro says ${lede?.[1] ?? "?"} websites, there are ${total} cards.`);
  const notLovable = cards.filter((c) => c.plat !== "Lovable").length;
  const other = gallery.match(/(\d+) on other platforms/);
  if (!other || Number(other[1]) !== notLovable) fail(`Intro says "${other?.[1] ?? "?"} on other platforms", there are ${notLovable}.`);

  for (const [id, keep] of [["lovable", (c) => c.plat === "Lovable"], ["other", (c) => c.plat !== "Lovable"]]) {
    const sec = gallery.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))?.[0];
    if (!sec) { fail(`Card section #${id} is missing.`); continue; }
    const inSec = cards.filter((c) => sec.includes(c.li));
    const head = sec.match(/<span class="n">(\d+) sites<\/span>/);
    if (!head || Number(head[1]) !== inSec.length) fail(`#${id} heading says ${head?.[1] ?? "?"} sites, it holds ${inSec.length}.`);
    for (const c of inSec) if (!keep(c)) fail(`${c.href} (${c.plat}) is in the wrong section (#${id}).`);
    const idx = inSec.map((c) => c.i);
    if (idx.join() !== inSec.map((_, n) => n).join()) fail(`#${id}: data-i should run 0…${inSec.length - 1} in order.`);
  }

  const platCount = new Map();
  for (const c of cards) platCount.set(c.plat, (platCount.get(c.plat) ?? 0) + 1);
  const segs = [...gallery.matchAll(/<i class="seg [^"]*" style="--w:([\d.]+)%" title="([^:"]+): (\d+)"><\/i>/g)];
  const legend = new Map([...gallery.matchAll(/<span class="lg [^"]*"><b>(\d+)<\/b> ([^<]+)<\/span>/g)].map((m) => [decode(m[2]), Number(m[1])]));
  for (const [plat, n] of platCount) {
    const seg = segs.find((m) => decode(m[2]) === plat);
    if (!seg) fail(`Platform bar has no segment for ${plat}.`);
    else {
      if (Number(seg[3]) !== n) fail(`Platform bar says ${plat}: ${seg[3]}, there are ${n}.`);
      const want = (n / total) * 100;
      if (Math.abs(Number(seg[1]) - want) > 0.006) fail(`Platform bar width for ${plat} is ${seg[1]}%, should be ${want.toFixed(2)}%.`);
    }
    if (legend.get(plat) !== n) fail(`Legend says ${plat}: ${legend.get(plat) ?? "missing"}, there are ${n}.`);
  }
  for (const m of segs) if (!platCount.has(decode(m[2]))) fail(`Platform bar has a segment for ${m[2]}, but no card uses it.`);

  const catCount = new Map();
  for (const c of cards) catCount.set(c.cat, (catCount.get(c.cat) ?? 0) + 1);
  const chips = new Map([...gallery.matchAll(/data-k="([^"]*)">[^<]*<em>(\d+)<\/em>/g)].map((m) => [decode(m[1]), Number(m[2])]));
  for (const [cat, n] of catCount) if (chips.get(cat) !== n) fail(`Filter chip "${cat}" says ${chips.get(cat) ?? "missing"}, there are ${n}.`);
  for (const cat of chips.keys()) if (!catCount.has(cat)) fail(`Filter chip "${cat}" has no cards.`);

  if (index !== null) {
    const big = index.match(/<p class="big" aria-hidden="true">(\d+)<\/p>\s*<h3>Student websites<\/h3>/);
    if (!big || Number(big[1]) !== total) fail(`index.html's Student websites card says ${big?.[1] ?? "?"}, there are ${total}.`);
  }
  if (readme !== null) {
    const lovable = platCount.get("Lovable") ?? 0;
    for (const [re, want, label] of [
      [/Student websites\*\* \((\d+) sites/, total, "the overview"],
      [/A gallery of the (\d+) websites students posted/, total, "the pages table"],
      [/\((\d+) on Lovable,/, lovable, "the Lovable count"],
      [/on Lovable, (\d+) on other platforms\)/, notLovable, "the other-platforms count"],
      [/holds all (\d+) cards/, total, "the files table"],
    ]) {
      const m = readme.match(re);
      if (!m || Number(m[1]) !== want) fail(`README.md ${label} says ${m?.[1] ?? "?"}, should be ${want}.`);
    }
  }

  const summary = `${total} cards (${platCount.get("Lovable") ?? 0} Lovable, ${notLovable} other), ${R} rated, ${total - R} unrated`;
  return { problems, summary };
}

// ---- command line --------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f) => readFileSync(path.join(root, f), "utf8");
  const { problems, summary } = checkGallery({
    gallery: read("student-websites.html"),
    index: read("index.html"),
    readme: read("README.md"),
  });
  if (problems.length) {
    console.error(`student gallery: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(`OK: ${summary}.`);
}
