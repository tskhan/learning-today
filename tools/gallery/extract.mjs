/* Reads a WhatsApp chat export on the owner's PC and updates data/gallery/links.json with the
   website links students posted. Only links and the dates they were posted are kept: no names,
   phone numbers or message text. The export itself is never copied into the repository.

   node tools/gallery/extract.mjs "<path to the export .txt>" [--export-date YYYY-MM-DD]

   Reads Android ("24/11/2026, 21:05 - Name: text") and iPhone ("[24/11/2026, 21:05:33] Name: text")
   exports, day-first or month-first (detected from the file). No dependencies. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseUrl } from "./lib/model.mjs";

// A message starts with a date: "[d/m/y, time] " (iPhone) or "d/m/y, time - " (Android).
const LINE = /^‎?\[?(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),? [^\]\-]*?(?:\] | - )/;
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
// Links pasted without "https://", on the hosts students use.
const BARE_RE = /(?<![\w./-])(?:[a-z0-9-]+\.)+(?:lovable\.app|vercel\.app|netlify\.app|github\.io|base44\.app|bolt\.host|freebuff\.app)(?:\/[^\s<>"'`]*)?/gi;

/** Links that are never student websites: chat and video, documents, social networks, AI tools,
    news, code hosting (github.io pages are kept) and this site itself. Anything else that isn't a
    student's site goes in data/gallery/removed.json with the reason "not-a-site". */
const IGNORE = [
  "chat.whatsapp.com", "wa.me", "whatsapp.com", "youtube.com", "youtu.be", "zoom.us", "meet.google.com",
  "docs.google.com", "drive.google.com", "forms.gle", "colab.research.google.com", "notion.so", "canva.com",
  "linkedin.com", "facebook.com", "fb.com", "instagram.com", "x.com", "twitter.com", "tiktok.com", "threads.net", "reddit.com", "medium.com",
  "chatgpt.com", "openai.com", "claude.ai", "claude.com", "anthropic.com", "gemini.google.com", "openrouter.ai", "ollama.com",
  "huggingface.co", "perplexity.ai", "deepseek.com", "modelcontextprotocol.io", "cursor.com", "lovable.dev",
  "github.com", "gitlab.com", "npmjs.com", "stackoverflow.com", "techcrunch.com", "theverge.com", "wikipedia.org",
  "piaic.org", "panaversity.org", "learning-today.com",
];
const ignored = (url) => {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return IGNORE.some((d) => host === d || host.endsWith(`.${d}`));
};

function dayFirst(lines) {
  for (const l of lines) {
    const m = l.replace(INVISIBLE, "").match(LINE);
    if (!m) continue;
    if (Number(m[1]) > 12) return true;
    if (Number(m[2]) > 12) return false;
  }
  return true;
}

const trimUrl = (u) => u.replace(/[.,;:!?)\]}*_]+$/, "");
// Direction marks and other invisible characters WhatsApp puts around names, links and Urdu text.
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;

function isoDate(m, df) {
  const [a, b, y] = [Number(m[1]), Number(m[2]), m[3]];
  const [d, mo] = df ? [a, b] : [b, a];
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The date of the chat's last message (the export date when none is given). */
export function lastMessageDate(text) {
  const lines = text.split(/\r?\n/);
  const df = dayFirst(lines);
  let date = null;
  for (const line of lines) {
    const m = line.replace(INVISIBLE, "").match(LINE);
    if (m) date = isoDate(m, df);
  }
  return date;
}

/** Every website link in the chat, in order, with the date its message was sent. */
export function parseChat(text) {
  const lines = text.split(/\r?\n/);
  const df = dayFirst(lines);
  const out = [];
  let date = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(INVISIBLE, "");
    const m = line.match(LINE);
    let body = line;
    if (m) {
      date = isoDate(m, df);
      body = line.slice(m[0].length);
    }
    if (!date) continue;
    const found = [...(body.match(URL_RE) ?? [])];
    const withoutFull = body.replace(URL_RE, " ");
    for (const bare of withoutFull.match(BARE_RE) ?? []) found.push(`https://${bare}`);
    for (const raw of found) {
      let url;
      try {
        url = normaliseUrl(trimUrl(raw));
      } catch {
        continue;
      }
      if (!ignored(url)) out.push({ url, date });
    }
  }
  return out;
}

/**
 * Merges the links found in an export into links.json's list. Exports hold the whole chat, so a
 * link's count is the larger of the saved and the new one; its first date is the earliest seen.
 */
export function mergeLinks(existing, found, removed) {
  const removedSet = new Set(removed.map((r) => r.url));
  const byUrl = new Map(existing.links.map((l) => [l.url, { ...l }]));
  const counts = new Map();
  const added = [];
  let skipped = 0;
  const skippedUrls = new Set();
  for (const { url, date } of found) {
    if (removedSet.has(url)) {
      if (!skippedUrls.has(url)) skipped++;
      skippedUrls.add(url);
      continue;
    }
    counts.set(url, (counts.get(url) ?? 0) + 1);
    const l = byUrl.get(url);
    if (!l) {
      byUrl.set(url, { url, firstPosted: date, lastPosted: date, times: 1 });
      added.push(url);
    } else {
      if (date < l.firstPosted) l.firstPosted = date;
      if (date > l.lastPosted) l.lastPosted = date;
    }
  }
  for (const [url, n] of counts) byUrl.get(url).times = Math.max(byUrl.get(url).times ?? 1, n);
  for (const url of removedSet) byUrl.delete(url);
  // Saved links keep their order (it is the order cards appear in); new ones go at the end, oldest first.
  const addedSet = new Set(added);
  const kept = [...byUrl.values()].filter((l) => !addedSet.has(l.url));
  const fresh = [...byUrl.values()].filter((l) => addedSet.has(l.url))
    .sort((a, b) => a.firstPosted.localeCompare(b.firstPosted) || a.url.localeCompare(b.url));
  const links = [...kept, ...fresh];
  return { links, added, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const exportDateArg = args.includes("--export-date") ? args[args.indexOf("--export-date") + 1] : null;
  if (!file) {
    console.error('Usage: node tools/gallery/extract.mjs "<path to the WhatsApp export .txt>" [--export-date YYYY-MM-DD]');
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const linksFile = path.join(root, "data/gallery/links.json");
  const removedFile = path.join(root, "data/gallery/removed.json");
  const existing = existsSync(linksFile) ? JSON.parse(readFileSync(linksFile, "utf8")) : { exportDate: null, links: [] };
  const removed = existsSync(removedFile) ? JSON.parse(readFileSync(removedFile, "utf8")) : [];
  const text = readFileSync(file, "utf8");
  const found = parseChat(text);
  if (found.length === 0) {
    console.error("No links found. Is this a WhatsApp chat export (.txt)?");
    process.exit(1);
  }
  const { links, added, skipped } = mergeLinks(existing, found, removed);
  const exportDate = exportDateArg ?? lastMessageDate(text);
  writeFileSync(linksFile, JSON.stringify({ exportDate, links }, null, 2) + "\n");
  console.log(`found ${new Set(found.map((f) => f.url)).size}, new ${added.length}, skipped (removed) ${skipped}; export date ${exportDate}`);
  for (const url of added) console.log(`  new: ${url}`);
  console.log("Check the new links are students' websites. For any that isn't, add it to data/gallery/removed.json as");
  console.log('  { "url": "<link>", "reason": "not-a-site" }  and run this again. Then commit data/gallery/links.json.');
}
