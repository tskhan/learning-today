/* Reads the committed student-websites.html into a page model (see the plan's shared data
   shapes). Used to seed data/gallery and by the golden test that keeps the renderer honest. */
import { searchText } from "./model.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const decodeHtml = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&middot;/g, "·").replace(/&amp;/g, "&");

/** "23 Nov 2026" → "2026-11-23" */
export function isoFromLong(text) {
  const [d, mon, y] = text.trim().split(/\s+/);
  return `${y}-${String(MONTHS.indexOf(mon) + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parsePage(html) {
  const exportDate = isoFromLong(html.match(/Compiled from the Batch 91 chat export of ([^.]+)\./)[1]);
  const range = html.match(/from (\d+ \w+) to (\d+ \w+ (\d{4}))/);
  const firstPosted = isoFromLong(`${range[1]} ${range[3]}`);
  const lastPosted = isoFromLong(range[2]);

  const cards = [...html.matchAll(/<li class="site"[\s\S]*?<\/li>/g)].map(([li]) => {
    const attr = (name) => {
      const m = li.match(new RegExp(`data-${name}="([^"]*)"`));
      return m ? decodeHtml(m[1]) : null;
    };
    const url = li.match(/<a href="([^"]*)"/)[1];
    const title = decodeHtml(li.match(/<h3>([\s\S]*?)<\/h3>/)[1]);
    const desc = li.match(/<\/h3><p>([\s\S]*?)<\/p>/);
    const rated = attr("overall") !== null;
    const card = {
      url,
      host: url.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      title,
      description: desc ? decodeHtml(desc[1]) : "",
      platform: attr("plat"),
      kind: attr("cat"),
      color: li.match(/--c:(#[0-9a-f]{6})/)[1],
      embeddable: /data-src="/.test(li),
      posted: li.match(/<div class="by">Posted ([^<]*)/)[1],
      timesPosted: Number(li.match(/<span class="x">posted (\d+)&times;<\/span>/)?.[1] ?? 1),
      offline: /<span class="off">/.test(li),
      scores: rated
        ? Object.fromEntries(["overall", "concept", "uniqueness", "design", "usability"].map((k) => [k, Number(attr(k))]))
        : null,
    };
    const q = attr("q");
    if (q !== searchText(card)) card.q = q;
    return card;
  });
  return { exportDate, firstPosted, lastPosted, cards };
}
