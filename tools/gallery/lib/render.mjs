/* Page model → student-websites.html. Fills the <!--G:…--> markers in tools/gallery/template.html,
   following docs/student-gallery.md: every number is computed here, from the final list of cards. */
import { competitionRanks } from "../../check-student-gallery.mjs";
import { KINDS, searchText } from "./model.mjs";

const CATS = ["concept", "uniqueness", "design", "usability"];
const LABEL = { concept: "Concept", uniqueness: "Uniqueness", design: "Design", usability: "Usability" };
const TOP_ROWS = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** HTML-escape text and attribute values the way the page always has (& < > " '). */
export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const slug = (platform) => platform.toLowerCase().replace(/\s+/g, "-");
const dayMonth = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const longDate = (iso) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

function cardHtml(c, i, overallRank, rated) {
  const s = c.scores;
  const attrs = [`data-i="${i}"`, `data-plat="${esc(c.platform)}"`, `data-cat="${esc(c.kind)}"`, `data-q="${esc(searchText(c))}"`];
  if (s) attrs.push(...["overall", ...CATS].map((k) => `data-${k}="${s[k]}"`));
  const badge = s
    ? `<span class="score" title="Overall rating ${s.overall} out of 100, rank ${overallRank} of ${rated}" aria-label="Overall rating ${s.overall} out of 100">${s.overall}<small>/100</small></span>`
    : `<span class="score none" title="This site could not be opened when the ratings were measured, so it has no score" aria-label="Not rated">Not rated</span>`;
  const title = [...c.title].slice(0, 80).join("");
  const desc = [...(c.description ?? "")].slice(0, 150).join("");
  return (
    `<li class="site" ${attrs.join(" ")}><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="shot" style="--c:${c.color}"${c.embeddable ? ` data-src="${esc(c.url)}"` : ""}>` +
    `<span class="ini" aria-hidden="true">${esc(c.title.charAt(0).toUpperCase())}</span>` +
    `<span class="hostline">${esc(c.host.slice(0, 40))}</span>${badge}</div>` +
    `<div class="info"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ""}` +
    `<div class="meta"><span class="pl ${slug(c.platform)}">${esc(c.platform)}</span><span class="cat">${esc(c.kind)}</span>${c.offline ? `<span class="off">Offline when checked</span>` : ""}</div>` +
    (s
      ? `<div class="four">${CATS.map((k) => `<span>${LABEL[k]} <b>${s[k]}</b></span>`).join("")}</div>` +
        `<div class="rk-line">Overall rank <b>#${overallRank}</b> of ${rated}</div>`
      : "") +
    `<div class="by">Posted ${esc(c.posted)}${c.timesPosted > 1 ? `<span class="x">posted ${c.timesPosted}&times;</span>` : ""}</div>` +
    `</div></a></li>`
  );
}

function rows(ratedCards, cat, ranks) {
  const order = ratedCards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.scores[cat] - a.c.scores[cat] || b.c.scores.overall - a.c.scores.overall || a.i - b.i);
  return order
    .map(({ c, i }, n) => {
      const s = c.scores;
      return (
        `<li class="rk${n < TOP_ROWS ? "" : " more"}"><span class="pos">#${ranks[i]}</span>` +
        `<a class="nm" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc([...c.title].slice(0, 70).join(""))}</a>` +
        `<span class="pl ${slug(c.platform)}">${esc(c.platform)}</span>` +
        `<span class="bar2" role="img" aria-label="${s[cat]} out of 100"><i style="--v:${s[cat]}%"></i></span>` +
        `<b class="num">${s[cat]}</b>` +
        `<span class="mini">${CATS.map((k) => `${LABEL[k]} ${s[k]}`).join(" &middot; ")}</span></li>`
      );
    })
    .join("");
}

/**
 * Renders the page. Cards are shown Lovable first, then everything else, each in the model's order;
 * ranks are competition ranks among rated cards.
 */
export function renderPage(model, template) {
  const lovable = model.cards.filter((c) => c.platform === "Lovable");
  const other = model.cards.filter((c) => c.platform !== "Lovable");
  const ordered = [...lovable, ...other];
  const total = ordered.length;
  const rated = ordered.filter((c) => c.scores);
  const R = rated.length;
  const rankOf = Object.fromEntries(["overall", ...CATS].map((k) => [k, competitionRanks(rated.map((c) => c.scores[k]))]));
  const overallRank = new Map(rated.map((c, i) => [c, rankOf.overall[i]]));

  const platforms = [];
  for (const c of ordered) if (!platforms.includes(c.platform)) platforms.push(c.platform);
  const count = (p) => ordered.filter((c) => c.platform === p).length;
  const split =
    `<div class="split"><div class="bar" role="img" aria-label="Websites by platform">` +
    platforms.map((p) => `<i class="seg ${slug(p)}" style="--w:${((count(p) / total) * 100).toFixed(2)}%" title="${esc(p)}: ${count(p)}"></i>`).join("") +
    `</div><div class="legend">` +
    platforms.map((p) => `<span class="lg ${slug(p)}"><b>${count(p)}</b> ${esc(p)}</span>`).join("") +
    `</div></div>`;

  const chips =
    `<button class="chip on" data-k="all">All</button>` +
    KINDS.filter((k) => ordered.some((c) => c.kind === k))
      .map((k) => `<button class="chip" data-k="${esc(k)}">${esc(k)} <em>${ordered.filter((c) => c.kind === k).length}</em></button>`)
      .join("");

  const sites = (n) => `${n} site${n === 1 ? "" : "s"}`;
  const cards = (list) => list.map((c, i) => cardHtml(c, i, overallRank.get(c), R)).join("");

  const fill = {
    total: String(total),
    range: `${dayMonth(model.firstPosted)} to ${longDate(model.lastPosted)}`,
    "other-count": String(other.length),
    split,
    chips,
    "lovable-sites": sites(lovable.length),
    "lovable-cards": cards(lovable),
    "other-sites": sites(other.length),
    "other-cards": cards(other),
    rated: String(R),
    "export-date": longDate(model.exportDate),
  };
  for (const cat of ["overall", ...CATS]) fill[`rows-${cat}`] = rows(rated, cat, rankOf[cat]);

  return template.replace(/<!--G:([a-z-]+)-->/g, (marker, name) => {
    if (!(name in fill)) throw new Error(`template marker without a value: ${name}`);
    return fill[name];
  });
}
