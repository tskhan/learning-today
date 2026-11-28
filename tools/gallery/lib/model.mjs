/* Shared rules for the student gallery: link identity, platform, tile colour, kinds of site and
   the text the page's search box matches. Used by every gallery script. */

/** The nine tile colours the page uses. Seeded sites keep their colour; new sites get colorOf(host). */
export const PALETTE = ["#8f1033", "#2c3a4d", "#1a6447", "#365510", "#0b6159", "#a03a08", "#6e2610", "#7a5000", "#0c5079"];

/** The kinds of site, in the order the filter chips show them. */
export const KINDS = ["App or game", "Business", "Food & drink", "Learning", "Other", "Portfolio", "Real estate", "Shop"];

/** One spelling per site: https, no "www.", no query or fragment, no trailing slash. */
export function normaliseUrl(raw) {
  const u = new URL(String(raw).trim());
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  return `https://${host}${u.port ? `:${u.port}` : ""}${path}`;
}

export const hostOf = (url) => url.replace(/^https?:\/\//, "").replace(/\/+$/, "");

const PLATFORMS = [
  [/\.lovable\.app$/, "Lovable"], [/\.netlify\.app$/, "Netlify"], [/\.vercel\.app$/, "Vercel"],
  [/\.base44\.app$/, "Base44"], [/\.github\.io$/, "GitHub Pages"], [/\.freebuff\.app$/, "Freebuff"],
  [/\.bolt\.host$/, "Bolt"], [/^(share\.google|sites\.google\.com)$/, "Google link"],
];

/** The hosting platform the page names for a link. */
export function platformOf(url) {
  const host = new URL(url).hostname.toLowerCase();
  for (const [re, name] of PLATFORMS) if (re.test(host)) return name;
  return "Custom domain";
}

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/** A stable tile colour for a new site. */
export const colorOf = (host) => PALETTE[fnv1a(host) % PALETTE.length];

/** What the search box matches: the card's full title and description, host, platform and kind. */
export function searchText(card) {
  if (card.q != null) return card.q;
  return `${card.title} ${card.description ?? ""} ${card.host} ${card.platform} ${card.kind}`.toLowerCase();
}
