/* How different each site is from the rest of the gallery: text (MinHash over word 3-shingles),
   look (distance between 64-bit screenshot hashes) and structure (the page's outline of headings
   and landmarks). Pure functions; fingerprints are saved in scores.json so uniqueness can be
   recomputed for every site on every run. */
import { roundHalfEven } from "../../check-student-gallery.mjs";

const HASHES = 64;

function fnv1a(s, seed) {
  let h = (0x811c9dc5 ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  // final avalanche so nearby seeds give independent hashes
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

function shingles(text) {
  const words = String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 3) return words.length ? [words.join(" ")] : [];
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return [...out];
}

/** 64 MinHash values (8 hex digits each) of the text's word 3-shingles. */
export function minhash(text) {
  const sh = shingles(text);
  let out = "";
  for (let k = 0; k < HASHES; k++) {
    let min = 0xffffffff;
    for (const s of sh) {
      const h = fnv1a(s, k);
      if (h < min) min = h;
    }
    out += min.toString(16).padStart(8, "0");
  }
  return out;
}

/** Estimated share of shingles two texts have in common (0–1). */
export function textSimilarity(a, b) {
  if (!a || !b) return 0;
  let same = 0;
  for (let k = 0; k < HASHES; k++) if (a.slice(k * 8, k * 8 + 8) === b.slice(k * 8, k * 8 + 8)) same++;
  return same / HASHES;
}

/** Number of differing bits between two 64-bit hashes written as 16 hex digits. */
export function hamming(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Longest common subsequence of two comma-separated outlines, over the longer one's length (0–1). */
export function outlineSimilarity(a, b) {
  const x = a ? a.split(",") : [];
  const y = b ? b.split(",") : [];
  if (!x.length && !y.length) return 1;
  const prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    let diag = 0;
    for (let j = 1; j <= y.length; j++) {
      const up = prev[j];
      prev[j] = x[i - 1] === y[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = up;
    }
  }
  return prev[y.length] / Math.max(x.length, y.length);
}

/**
 * Uniqueness 0–100 for every site: 50% text, 30% look, 20% structure, each measured against the
 * most similar other site. A starter template's text counts as fully similar.
 */
export function uniquenessScores(sites) {
  const urls = Object.keys(sites);
  const out = {};
  for (const u of urls) {
    const s = sites[u];
    let maxText = 0, minHam = 64, maxOutline = 0;
    for (const v of urls) {
      if (v === u) continue;
      const o = sites[v];
      maxText = Math.max(maxText, textSimilarity(s.minhash, o.minhash));
      if (s.dhash && o.dhash) minHam = Math.min(minHam, hamming(s.dhash, o.dhash));
      maxOutline = Math.max(maxOutline, outlineSimilarity(s.outline, o.outline));
    }
    const text = s.starter ? 0 : 100 * (1 - maxText);
    const look = 100 * Math.min(1, minHam / 24);
    const structure = 100 * (1 - maxOutline);
    out[u] = roundHalfEven(0.5 * text + 0.3 * look + 0.2 * structure);
  }
  return out;
}
