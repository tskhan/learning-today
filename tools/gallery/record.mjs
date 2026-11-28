/* Checks a batch of judgments written by the Claude Code session and saves it into
   data/gallery/.run/judgments.json. A batch with any problem is refused whole.

   node tools/gallery/record.mjs <batch.json>

   A batch is a JSON list of { url, concept, designLook, kind, reason }: scores are whole numbers
   0–100, kind is one of the gallery's kinds of site, and the reason is one kind sentence of at
   most 160 characters (scores.json is public). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS } from "./lib/model.mjs";

const score = (v) => Number.isInteger(v) && v >= 0 && v <= 100;

/** Problems with a batch, or [] when it can be saved. */
export function validateJudgments(list, queue) {
  if (!Array.isArray(list)) return ["The batch must be a JSON list of judgments."];
  const allowed = new Set(queue.map((q) => q.url));
  const seen = new Set();
  const problems = [];
  for (const j of list) {
    const who = j?.url ?? "(no url)";
    if (!allowed.has(j?.url)) problems.push(`${who}: not in the queue (run queue.mjs and judge the listed sites).`);
    if (seen.has(j?.url)) problems.push(`${who}: judged twice in this batch.`);
    seen.add(j?.url);
    if (!score(j?.concept)) problems.push(`${who}: concept must be a whole number 0–100.`);
    if (!score(j?.designLook)) problems.push(`${who}: designLook must be a whole number 0–100.`);
    if (!KINDS.includes(j?.kind)) problems.push(`${who}: kind must be one of ${KINDS.join(", ")}.`);
    if (typeof j?.reason !== "string" || !j.reason.trim() || j.reason.length > 160) problems.push(`${who}: reason must be one sentence of 1–160 characters.`);
  }
  return problems;
}

/** Validates `file` against the run's queue and merges it into judgments.json. Returns the problems. */
export function recordJudgments(file, runDir, { today, rubricVersion }) {
  const queue = JSON.parse(readFileSync(path.join(runDir, "queue.json"), "utf8"));
  let list;
  try {
    list = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return [`Could not read ${file} as JSON: ${e.message}`];
  }
  const problems = validateJudgments(list, queue);
  if (problems.length) return problems;
  const target = path.join(runDir, "judgments.json");
  const saved = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
  for (const { url, concept, designLook, kind, reason } of list) {
    saved[url] = { concept, designLook, kind, reason: reason.trim(), judgedAt: today, rubricVersion };
  }
  writeFileSync(target, JSON.stringify(saved, null, 2) + "\n");
  return [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node tools/gallery/record.mjs <batch.json>");
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const data = path.join(root, "data/gallery");
  const { rubricVersion } = JSON.parse(readFileSync(path.join(data, "scores.json"), "utf8"));
  const problems = recordJudgments(path.resolve(file), path.join(data, ".run"), { today: new Date().toISOString().slice(0, 10), rubricVersion });
  if (problems.length) {
    console.error(`Batch refused (nothing saved):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Saved. Run queue.mjs for the next batch.");
}
