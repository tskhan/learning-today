/* One-off: seeds data/gallery/links.json and scores.json from the committed student-websites.html,
   so the generator can build before the next WhatsApp export. Seeded sites keep today's scores as
   `legacy` (methodVersion 0) until they are measured and judged under the new method.

   node tools/gallery/seed.mjs            (refuses to overwrite existing files)
   node tools/gallery/seed.mjs --force */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePage } from "./lib/parse-page.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20 Oct" → ISO date, in the year of the page's date range (a month after the last one is the year before). */
function isoFromShort(dayMonth, lastPosted) {
  const [d, mon] = dayMonth.split(" ");
  const m = MONTHS.indexOf(mon) + 1;
  const lastYear = Number(lastPosted.slice(0, 4));
  const year = m > Number(lastPosted.slice(5, 7)) ? lastYear - 1 : lastYear;
  return `${year}-${String(m).padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function seed(html) {
  const model = parsePage(html);
  const links = {
    exportDate: model.exportDate,
    links: model.cards.map((c) => {
      const date = isoFromShort(c.posted, model.lastPosted);
      return { url: c.url, firstPosted: date, lastPosted: date, times: c.timesPosted };
    }),
  };
  const sites = {};
  for (const c of model.cards) {
    sites[c.url] = {
      methodVersion: 0,
      title: c.title,
      description: c.description,
      ...(c.q != null ? { q: c.q } : {}),
      host: c.host,
      platform: c.platform,
      color: c.color,
      embeddable: c.embeddable,
      status: c.offline ? "offline" : "ok",
      lastOkAt: c.offline ? null : model.exportDate,
      fingerprint: { minhash: "", dhash: "", outline: "" },
      measured: null,
      judged: null,
      legacy: c.scores ? { ...c.scores, kind: c.kind } : { kind: c.kind },
    };
  }
  return { links, scores: { methodVersion: 1, rubricVersion: 1, sites } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const dir = path.join(root, "data/gallery");
  const files = { links: path.join(dir, "links.json"), scores: path.join(dir, "scores.json") };
  if (!process.argv.includes("--force") && Object.values(files).some(existsSync)) {
    console.error("data/gallery already has links.json or scores.json; pass --force to overwrite.");
    process.exit(1);
  }
  const { links, scores } = seed(readFileSync(path.join(root, "student-websites.html"), "utf8"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(files.links, JSON.stringify(links, null, 2) + "\n");
  writeFileSync(files.scores, JSON.stringify(scores, null, 2) + "\n");
  for (const f of ["removed.json", "anchors.json"]) if (!existsSync(path.join(dir, f))) writeFileSync(path.join(dir, f), "[]\n");
  console.log(`Seeded ${links.links.length} links and ${Object.keys(scores.sites).length} sites into data/gallery/.`);
}
