/* Visits every link in data/gallery/links.json in a real browser, at desktop (1280×800) and phone
   (390×844) size, and measures what the scoring needs: speed, phone fit, accessibility (axe-core),
   errors, contrast, layout shift, images and fonts. It also takes the screenshots the Claude
   session judges from, and the fingerprints that tell whether a site changed.

   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/gallery/measure.mjs [--only <url>]

   Writes data/gallery/.run/measurements.json and data/gallery/.shots/ (both git-ignored). */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { designMeasuredScore, usabilityScore } from "./lib/score.mjs";
import { minhash } from "./lib/unique.mjs";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const VIEWS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.625, tap: 24 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tap: 40 },
};
const STARTER = /welcome to your (new|blank) (app|project|site)|start building your|your blank app|get started by editing|edit src\/app|vite \+ react|this is a blank/i;
// Phone-number candidates; only runs with 10 or more digits count (so years, prices and times don't).
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const isPhone = (s) => (s.match(/\d/g) ?? []).length >= 10;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/** Drops every sentence that held a phone number or email address; other text is left as it is. */
export function stripContacts(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  const marked = clean.replace(EMAIL, "\u0000").replace(PHONE, (m) => (isPhone(m) ? "\u0000" : m));
  if (!marked.includes("\u0000")) return clean;
  return marked.split(/(?<=[.!?])\s+/).filter((s) => !s.includes("\u0000")).join(" ").trim();
}

// Collected in the page from the start: largest contentful paint and layout shift.
const INIT = () => {
  window.__lt = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.lcp = Math.max(window.__lt.lcp, e.startTime); })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__lt.cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  } catch {}
};

// Runs in the page after it has loaded: everything except axe.
const READ = (tap) => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const targets = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")].filter(visible);
  const small = targets.filter((el) => { const r = el.getBoundingClientRect(); return r.width < tap || r.height < tap; }).length;
  const imgs = [...document.images].filter(visible);
  const badImages = imgs.filter((img) => {
    if (img.complete && img.naturalWidth === 0) return true; // broken
    if (!img.naturalWidth) return false;
    const r = img.getBoundingClientRect();
    const fit = getComputedStyle(img).objectFit;
    const upscaled = r.width > img.naturalWidth * 1.5 && !/\.svg($|\?)/i.test(img.currentSrc);
    const distorted = fit === "fill" && Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) > 0.15 * (img.naturalWidth / img.naturalHeight);
    return upscaled || distorted;
  }).length;
  const fonts = new Set();
  for (const el of [...document.querySelectorAll("h1,h2,h3,h4,p,a,li,button,span,label")].slice(0, 400)) {
    if (visible(el) && el.textContent.trim()) fonts.add(getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase());
  }
  const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  const outline = [...document.querySelectorAll("h1,h2,h3,nav,header,main,section,article,aside,form,footer,table")]
    .slice(0, 60).map((el) => el.tagName.toLowerCase()).join(",");
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content") ?? "";
  return {
    lcp: window.__lt?.lcp ?? 0,
    load: performance.getEntriesByType("navigation")[0]?.loadEventEnd ?? 0,
    cls: window.__lt?.cls ?? 0,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    smallTapFraction: targets.length ? small / targets.length : 0,
    badImages,
    fontFamilies: fonts.size,
    title: document.title.trim(),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map((h) => h.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12),
    text: text.slice(0, 20000),
    outline,
    passwordWall: !!document.querySelector("input[type=password]") && text.split(" ").length < 80,
    pageHeight: document.documentElement.scrollHeight,
  };
};

// 64-bit difference hash of an image (9×8 grayscale), computed on a blank page's canvas.
async function dhashOf(browser, png) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 9; c.height = 8;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, 9, 8);
      const d = g.getImageData(0, 0, 9, 8).data;
      const lum = (x, y) => { const i = (y * 9 + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
      let bits = "";
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += lum(x, y) > lum(x + 1, y) ? "1" : "0";
      return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
    }, png.toString("base64"));
  } finally {
    await page.close();
  }
}

const AUTH_HOSTS = ["vercel.com", "lovable.dev", "accounts.google.com", "app.base44.com", "github.com", "netlify.com", "bolt.new"];

/** True when a visit to `requested` ended on a sign-in page somewhere else (a login wall). */
export function landedOnSignIn(requested, final) {
  const a = new URL(requested), b = new URL(final);
  const same = a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") && a.pathname.replace(/\/+$/, "") === b.pathname.replace(/\/+$/, "");
  if (same) return false;
  return AUTH_HOSTS.includes(b.hostname.replace(/^www\./, "")) || /^(accounts|auth|login|sso|signin)\./.test(b.hostname) ||
    /(^|\/)(log-?in|sign-?in|sign-?up|sso|auth|oauth|session)(\/|$|\?)/i.test(b.pathname);
}

function frameable(headers) {
  const xfo = (headers["x-frame-options"] ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const fa = (headers["content-security-policy"] ?? "").match(/frame-ancestors([^;]*)/i);
  if (fa && !/(^|\s)\*(\s|$)/.test(fa[1])) return false;
  return true;
}

async function measureView(browser, url, name, { shotsDir, timeoutMs, slugName }) {
  const { tap, ...options } = VIEWS[name];
  const context = await browser.newContext({ ...options, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript(INIT);
  let errors = 0, failedRequests = 0;
  page.on("pageerror", () => errors++);
  const counted = new Set(["document", "script", "stylesheet", "fetch", "xhr"]);
  page.on("requestfailed", (r) => { if (counted.has(r.resourceType())) failedRequests++; });
  page.on("response", (r) => { if (r.status() >= 400 && counted.has(r.request().resourceType()) && r.request() !== mainRequest) failedRequests++; });
  let mainRequest = null;
  try {
    // Wait for the page's content, then for "load" if it comes: a page that never finishes loading
    // (one stuck image) is still measured, and its speed scores low on its own.
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    mainRequest = response?.request() ?? null;
    await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const r = await page.evaluate(READ, tap);
    await page.addScriptTag({ content: AXE }).catch(() => {});
    const axe = await page
      .evaluate(async () => {
        if (!window.axe) return null;
        const res = await window.axe.run(document, { resultTypes: ["violations"] });
        const serious = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        return {
          serious: serious.filter((v) => v.id !== "color-contrast").reduce((n, v) => n + v.nodes.length, 0),
          contrast: (res.violations.find((v) => v.id === "color-contrast")?.nodes.length) ?? 0,
        };
      })
      .catch(() => null);
    let shot = null;
    if (name === "desktop") {
      shot = path.join(shotsDir, `${slugName}-desktop.png`);
      await page.screenshot({ path: shot, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(1600, Math.max(800, r.pageHeight)) } });
    } else {
      shot = path.join(shotsDir, `${slugName}-phone.png`);
      await page.screenshot({ path: shot });
    }
    return {
      status: (response && response.status() >= 400) || r.passwordWall || landedOnSignIn(url, page.url()) ? "blocked" : "ok",
      headers: response ? await response.allHeaders() : {},
      read: r,
      shot,
      raw: {
        lcpMs: Math.round(r.lcp || r.load),
        overflow: r.overflow,
        smallTapFraction: Math.round(r.smallTapFraction * 1000) / 1000,
        axeSerious: axe?.serious ?? 0,
        errors,
        failedRequests,
        contrastFailures: axe?.contrast ?? 0,
        cls: Math.round(r.cls * 1000) / 1000,
        badImages: r.badImages,
        fontFamilies: r.fontFamilies,
      },
    };
  } catch (e) {
    return { status: "offline", error: String(e.message ?? e).split("\n")[0] };
  } finally {
    await context.close();
  }
}

/** Measures one site. Never throws: a site that can't be opened comes back `offline`. */
export async function measureSite(browser, url, { shotsDir, timeoutMs = 30000 } = {}) {
  mkdirSync(shotsDir, { recursive: true });
  const slugName = createHash("sha1").update(url).digest("hex").slice(0, 12);
  const opts = { shotsDir, timeoutMs, slugName };
  const guard = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r({ status: "offline", error: "timed out" }), timeoutMs * 2 + 20000))]);
  const desktop = await guard(measureView(browser, url, "desktop", opts));
  if (desktop.status === "offline") return { status: "offline", error: desktop.error };
  const phone = await guard(measureView(browser, url, "phone", opts));
  if (phone.status === "offline") return { status: "offline", error: phone.error };
  const r = desktop.read;
  const base = { title: r.title, description: stripContacts(r.description), embeddable: frameable(desktop.headers) };
  if (desktop.status === "blocked") return { status: "blocked", ...base };
  const raw = { desktop: desktop.raw, phone: phone.raw };
  const words = stripContacts(r.text).split(" ");
  return {
    status: "ok",
    ...base,
    fingerprint: { minhash: minhash(r.text), dhash: await dhashOf(browser, readFileSync(desktop.shot)), outline: r.outline },
    starter: STARTER.test(r.text),
    measured: { usability: usabilityScore(raw), designMeasured: designMeasuredScore(raw), raw },
    digest: { headings: r.headings.map(stripContacts), text: words.slice(0, 300).join(" ") },
    shots: { desktop: desktop.shot, phone: phone.shot },
  };
}

/** Runs `fn` over `items`, `n` at a time. */
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const data = path.join(root, "data/gallery");
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  const { links } = JSON.parse(readFileSync(path.join(data, "links.json"), "utf8"));
  const urls = links.map((l) => l.url).filter((u) => !only || u === only);
  const shotsDir = path.join(data, ".shots");
  mkdirSync(path.join(data, ".run"), { recursive: true });
  // The published page as it was before this regeneration, for the pull request summary.
  if (!only) writeFileSync(path.join(data, ".run/baseline.html"), readFileSync(path.join(root, "student-websites.html")));
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const results = {};
  let done = 0;
  await pool(urls, 4, async (url) => {
    results[url] = await measureSite(browser, url, { shotsDir });
    done++;
    console.log(`[${done}/${urls.length}] ${results[url].status.padEnd(7)} ${url}${results[url].error ? `  (${results[url].error})` : ""}`);
  });
  await browser.close();
  const out = { runAt: new Date().toISOString().slice(0, 10), results };
  writeFileSync(path.join(data, ".run/measurements.json"), JSON.stringify(out, null, 2) + "\n");
  const counts = Object.values(results).reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  console.log(`Measured ${urls.length}: ${JSON.stringify(counts)}. Wrote data/gallery/.run/measurements.json.`);
  if ((counts.offline ?? 0) > urls.length / 2) {
    console.log("More than half the sites look offline. If the errors mention a proxy or blocked host, this environment can't reach the internet: see the skill's preconditions.");
  }
}
