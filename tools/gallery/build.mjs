/* Builds student-websites.html: merges this run's measurements and judgments into
   data/gallery/scores.json, works out every score and rank, renders the page from template.html,
   updates the Student websites counts in index.html and README.md, and runs the gallery checker.
   Nothing is written unless the checker passes.

   node tools/gallery/build.mjs

   Reads data/gallery/links.json, scores.json and, when present, .run/measurements.json and
   .run/judgments.json. Prints a summary for the pull request. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkGallery } from "../check-student-gallery.mjs";
import { colorOf, hostOf, platformOf } from "./lib/model.mjs";
import { parsePage } from "./lib/parse-page.mjs";
import { renderPage } from "./lib/render.mjs";
import { designScore, needsJudging, overallScore } from "./lib/score.mjs";
import { uniquenessScores } from "./lib/unique.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KEEP_OFFLINE_DAYS = 60;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
const dayMonth = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** A readable title from an address, for sites whose page never loaded: "my-shop--x.lovable.app" → "My Shop X". */
export function titleFromHost(host) {
  return host.split(/[./]/)[0].split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Merges a run into the saved state. Unchanged sites keep their saved measurements and judgment
 * (so their scores don't drift between exports); new or changed sites take the new measurement and,
 * once judged, the new judgment. Sites that didn't load keep everything and are marked offline or blocked.
 */
export function mergeState(scores, measurements, judgments, today) {
  const out = structuredClone(scores);
  for (const [url, m] of Object.entries(measurements?.results ?? {})) {
    const prev = out.sites[url];
    const host = hostOf(url);
    const s = prev ?? { methodVersion: 0, title: "", description: "", host, platform: platformOf(url), color: colorOf(host),
      embeddable: false, status: "offline", lastOkAt: null, fingerprint: { minhash: "", dhash: "", outline: "" }, measured: null, judged: null };
    if (m.status === "ok") {
      const changed = !s.measured || fingerprintChanged(s, m);
      if (changed) {
        s.fingerprint = m.fingerprint;
        s.starter = m.starter;
        s.measured = m.measured;
      }
      if (m.title || m.description) {
        if (m.title !== s.title || m.description !== s.description) delete s.q;
        s.title = m.title || s.title;
        s.description = m.description ?? "";
      }
      s.embeddable = m.embeddable;
      s.status = "ok";
      s.lastOkAt = today;
    } else {
      s.status = m.status;
      if (m.status === "blocked" && m.title) s.title = s.title || m.title;
    }
    if (judgments[url]) s.judged = judgments[url];
    s.methodVersion = s.judged && s.measured ? 1 : 0;
    out.sites[url] = s;
  }
  return out;
}

/** True when the saved fingerprint and a fresh one differ beyond the re-judge thresholds. */
function fingerprintChanged(saved, fresh) {
  return needsJudging({ fingerprint: saved.fingerprint, judged: { rubricVersion: 1 } }, fresh, 1);
}

/** The scores a card shows, or null when it is unrated. */
function cardScores(s, uniqueness, url, today) {
  const reachable = s.status === "ok" || (s.lastOkAt && days(s.lastOkAt, today) <= KEEP_OFFLINE_DAYS);
  if (!reachable) return null;
  if (s.methodVersion === 1 && s.judged && s.measured) {
    const four = {
      concept: s.judged.concept,
      uniqueness: uniqueness[url] ?? 100,
      design: designScore(s.measured.designMeasured, s.judged.designLook),
      usability: s.measured.usability,
    };
    return { overall: overallScore(four), ...four };
  }
  if (s.legacy?.overall != null) {
    const { overall, concept, uniqueness: u, design, usability } = s.legacy;
    return { overall, concept, uniqueness: u, design, usability };
  }
  return null;
}

/** The page model: one card per link, in links.json order. */
export function toPageModel(scores, links, today = links.exportDate) {
  const withFp = Object.fromEntries(
    Object.entries(scores.sites)
      .filter(([, s]) => s.fingerprint?.minhash)
      .map(([url, s]) => [url, { ...s.fingerprint, starter: !!s.starter }]),
  );
  const uniqueness = uniquenessScores(withFp);
  const cards = links.links.map((l) => {
    const s = scores.sites[l.url] ?? { host: hostOf(l.url), platform: platformOf(l.url), color: colorOf(hostOf(l.url)), status: "offline" };
    const card = {
      url: l.url,
      host: s.host ?? hostOf(l.url),
      title: s.title || titleFromHost(s.host ?? hostOf(l.url)),
      description: s.description ?? "",
      platform: s.platform ?? platformOf(l.url),
      kind: s.judged?.kind ?? s.legacy?.kind ?? "Other",
      color: s.color ?? colorOf(hostOf(l.url)),
      embeddable: !!s.embeddable,
      posted: dayMonth(l.firstPosted),
      timesPosted: l.times ?? 1,
      offline: s.status !== "ok",
      scores: cardScores(s, uniqueness, l.url, today),
    };
    if (s.q != null) card.q = s.q;
    return card;
  });
  const dates = links.links.map((l) => l.firstPosted).sort();
  return { exportDate: links.exportDate, firstPosted: dates[0], lastPosted: dates.at(-1), cards };
}

/** Puts the new totals into index.html and README.md, at the places the checker reads. */
function updateCounts(index, readme, model) {
  const total = model.cards.length;
  const lovable = model.cards.filter((c) => c.platform === "Lovable").length;
  const other = total - lovable;
  const newIndex = index.replace(/(<p class="big" aria-hidden="true">)\d+(<\/p>\s*<h3>Student websites<\/h3>)/, `$1${total}$2`);
  const newReadme = readme
    .replace(/(Student websites\*\* \()\d+( sites)/, `$1${total}$2`)
    .replace(/(A gallery of the )\d+( websites students posted \()\d+( on Lovable, )\d+( on other platforms\))/, `$1${total}$2${lovable}$3${other}$4`)
    .replace(/(holds all )\d+( cards)/, `$1${total}$2`);
  return { index: newIndex, readme: newReadme };
}

/** Everything the CLI does, without touching files. */
export function buildAll({ links, scores, measurements, judgments, template, index, readme, previous, today }) {
  const merged = measurements ? mergeState(scores, measurements, judgments, today) : scores;
  const model = toPageModel(merged, links, today);
  const html = renderPage(model, template);
  const counts = updateCounts(index, readme, model);
  const { problems } = checkGallery({ gallery: html, index: counts.index, readme: counts.readme });

  const before = previous ? new Map(parsePage(previous).cards.map((c) => [c.url, c])) : new Map();
  const summary = {
    added: model.cards.filter((c) => !before.has(c.url)).map((c) => c.url),
    moved: model.cards
      .filter((c) => c.scores && before.get(c.url)?.scores && Math.abs(c.scores.overall - before.get(c.url).scores.overall) >= 5)
      .map((c) => ({ url: c.url, from: before.get(c.url).scores.overall, to: c.scores.overall })),
    unrated: model.cards.filter((c) => !c.scores).map((c) => c.url),
    offline: model.cards.filter((c) => c.offline).map((c) => c.url),
  };
  return { scores: merged, html, index: counts.index, readme: counts.readme, problems, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const at = (f) => path.join(root, f);
  const json = (f, fallback) => (existsSync(at(f)) ? JSON.parse(readFileSync(at(f), "utf8")) : fallback);
  const out = buildAll({
    links: json("data/gallery/links.json"),
    scores: json("data/gallery/scores.json"),
    measurements: json("data/gallery/.run/measurements.json", null),
    judgments: json("data/gallery/.run/judgments.json", {}),
    template: readFileSync(at("tools/gallery/template.html"), "utf8"),
    index: readFileSync(at("index.html"), "utf8"),
    readme: readFileSync(at("README.md"), "utf8"),
    previous: readFileSync(at("student-websites.html"), "utf8"),
    today: new Date().toISOString().slice(0, 10),
  });
  if (out.problems.length) {
    console.error(`Build refused, nothing written. The checker found:\n${out.problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  writeFileSync(at("data/gallery/scores.json"), JSON.stringify(out.scores, null, 2) + "\n");
  writeFileSync(at("student-websites.html"), out.html);
  writeFileSync(at("index.html"), out.index);
  writeFileSync(at("README.md"), out.readme);
  const s = out.summary;
  console.log(`Built student-websites.html: OK.`);
  console.log(`New sites (${s.added.length}):${s.added.map((u) => `\n  ${u}`).join("")}`);
  console.log(`Overall moved by 5 or more (${s.moved.length}):${s.moved.map((m) => `\n  ${m.url}: ${m.from} → ${m.to}`).join("")}`);
  console.log(`Offline or blocked this run (${s.offline.length}); unrated (${s.unrated.length}):${s.unrated.map((u) => `\n  ${u}`).join("")}`);
}
