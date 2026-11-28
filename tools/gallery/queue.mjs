/* Lists the next batch of sites for the Claude Code session to judge: new, changed or never-judged
   sites that loaded on this run, minus those already judged in this run. Prints the anchors first
   (sites with agreed scores, for calibration), then each site's screenshots and a text digest.

   node tools/gallery/queue.mjs [--batch 15]

   Writes the batch to data/gallery/.run/queue.json; record.mjs only accepts judgments for it. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { needsJudging } from "./lib/score.mjs";

/** Sites that still need judging, in measurement order. */
export function buildQueue(measurements, scores, rubricVersion, judged = {}) {
  return Object.entries(measurements.results)
    .filter(([url, m]) => m.status === "ok" && !(url in judged) && needsJudging(scores.sites[url], m, rubricVersion))
    .map(([url, m]) => ({ url, title: m.title, shots: m.shots, digest: m.digest }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const data = path.join(root, "data/gallery");
  const read = (f, fallback) => (existsSync(path.join(data, f)) ? JSON.parse(readFileSync(path.join(data, f), "utf8")) : fallback);
  const batch = process.argv.includes("--batch") ? Number(process.argv[process.argv.indexOf("--batch") + 1]) : 15;
  const measurements = read(".run/measurements.json", null);
  if (!measurements) {
    console.error("No data/gallery/.run/measurements.json: run measure.mjs first.");
    process.exit(1);
  }
  const scores = read("scores.json", { rubricVersion: 1, sites: {} });
  const all = buildQueue(measurements, scores, scores.rubricVersion, read(".run/judgments.json", {}));
  const next = all.slice(0, batch);
  writeFileSync(path.join(data, ".run/queue.json"), JSON.stringify(next, null, 2) + "\n");
  if (!next.length) {
    console.log("Nothing left to judge. Run build.mjs.");
    process.exit(0);
  }
  const anchors = read("anchors.json", []);
  const lines = [`# Judging batch: ${next.length} of ${all.length} left (rubric version ${scores.rubricVersion})`, ""];
  if (anchors.length) {
    lines.push("## Anchors (agreed scores: look at these first)", "");
    for (const a of anchors) {
      const shots = measurements.results[a.url]?.shots;
      lines.push(`- ${a.url}: Concept ${a.concept}, Design-look ${a.designLook}. ${a.reason}`);
      if (shots) lines.push(`  - desktop: ${shots.desktop}`, `  - phone: ${shots.phone}`);
    }
    lines.push("");
  }
  lines.push("## Sites", "");
  for (const q of next) {
    lines.push(`### ${q.url}`, `Title: ${q.title || "(none)"}`, `- desktop: ${q.shots.desktop}`, `- phone: ${q.shots.phone}`,
      `Headings: ${q.digest.headings.join(" | ") || "(none)"}`, `Text: ${q.digest.text || "(none)"}`, "");
  }
  lines.push("Write a JSON list of { url, concept, designLook, kind, reason } and run: node tools/gallery/record.mjs <file>");
  console.log(lines.join("\n"));
}
