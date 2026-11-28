import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { measureSite } from "../measure.mjs";

const SITES = new URL("./fixtures/sites/", import.meta.url);
const TYPES = { ".html": "text/html", ".svg": "image/svg+xml" };
let server, base, closedUrl, browser;
const shotsDir = mkdtempSync(path.join(tmpdir(), "gallery-shots-"));

before(async () => {
  server = http.createServer((req, res) => {
    const [, site, rest] = req.url.split("?")[0].split("/");
    const file = rest || "index.html";
    const p = new URL(`${site}/${file}`, SITES);
    if (site === "redirect") { res.writeHead(302, { location: `http://localhost:${server.address().port}/login/` }); res.end(); return; }
    if (site === "hang" && file === "never.png") return; // never answers
    if (!existsSync(p)) { res.writeHead(404); res.end("not found"); return; }
    const headers = { "content-type": TYPES[path.extname(p.pathname)] ?? "application/octet-stream" };
    if (site === "broken") headers["x-frame-options"] = "SAMEORIGIN";
    const send = () => { res.writeHead(200, headers); res.end(readFileSync(p)); };
    if (site === "slow" && file === "index.html") setTimeout(send, 4000); else send();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const tmp = http.createServer();
  await new Promise((r) => tmp.listen(0, "127.0.0.1", r));
  closedUrl = `http://127.0.0.1:${tmp.address().port}/`;
  await new Promise((r) => tmp.close(r));
  browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
});
after(async () => { await browser?.close(); server?.close(); });

const results = {};
const measure = async (site) => (results[site] ??= await measureSite(browser, `${base}/${site}/`, { shotsDir, timeoutMs: 15000 }));

test("a good page is ok, usable, embeddable, and its description loses phone and email", async () => {
  const m = await measure("good");
  assert.equal(m.status, "ok");
  assert.ok(m.measured.usability >= 85, `usability ${m.measured.usability}`);
  assert.equal(m.embeddable, true);
  assert.equal(m.title, "Green Leaf Bakery | Fresh bread in Karachi");
  assert.doesNotMatch(m.description, /1234567|hello@/);
  assert.match(m.description, /Fresh sourdough every morning/);
  assert.equal(m.starter, false);
  assert.match(m.fingerprint.minhash, /^[0-9a-f]{512}$/);
  assert.match(m.fingerprint.dhash, /^[0-9a-f]{16}$/);
  assert.match(m.fingerprint.outline, /^header,h1,nav,main,section,h2/);
  assert.ok(m.digest.headings.includes("Our bread"));
  assert.ok(m.digest.text.split(/\s+/).length <= 300);
});

test("screenshots: desktop 800 px wide for judging, plus the phone view", async () => {
  const m = await measure("good");
  const png = readFileSync(m.shots.desktop);
  assert.equal(png.readUInt32BE(16), 800);
  assert.ok(existsSync(m.shots.phone));
});

test("a slow page scores lower on speed", async () => {
  const [good, slow] = [await measure("good"), await measure("slow")];
  assert.ok(slow.measured.raw.desktop.lcpMs > 3500, `lcp ${slow.measured.raw.desktop.lcpMs}`);
  assert.ok(slow.measured.usability < good.measured.usability);
});

test("a broken page loses points for errors and accessibility, and refuses framing", async () => {
  const [good, broken] = [await measure("good"), await measure("broken")];
  assert.ok(broken.measured.raw.desktop.errors >= 1);
  assert.ok(broken.measured.raw.desktop.failedRequests >= 1);
  assert.ok(broken.measured.raw.desktop.axeSerious > good.measured.raw.desktop.axeSerious);
  assert.ok(broken.measured.usability < good.measured.usability);
  assert.equal(broken.embeddable, false);
});

test("a starter template is flagged", async () => {
  assert.equal((await measure("starter")).starter, true);
});

test("a site that is down is offline, quickly, without throwing", async () => {
  const t = Date.now();
  const m = await measureSite(browser, closedUrl, { shotsDir, timeoutMs: 5000 });
  assert.equal(m.status, "offline");
  assert.ok(Date.now() - t < 15000);
});

test("stripContacts drops whole sentences that held a phone number or email", async () => {
  const { stripContacts } = await import("../measure.mjs");
  assert.equal(stripContacts("Fresh sourdough every morning. Call +92 300 1234567 or email hello@greenleaf.example to order."), "Fresh sourdough every morning.");
  assert.equal(stripContacts("Portfolio of Sara. Reach me: sara@example.com"), "Portfolio of Sara.");
  assert.equal(stripContacts("Open daily from 9 to 5"), "Open daily from 9 to 5");
});

test("a site that redirects to a sign-in page is blocked, not ranked", async () => {
  const m = await measureSite(browser, `${base}/redirect/`, { shotsDir, timeoutMs: 10000 });
  assert.equal(m.status, "blocked");
});

test("a page that shows its content but never fires load is still measured", async () => {
  const m = await measureSite(browser, `${base}/hang/`, { shotsDir, timeoutMs: 5000 });
  assert.equal(m.status, "ok");
  assert.match(m.digest.text, /never finishes loading/);
});

test("stripContacts leaves clean text alone and doesn't take years or prices for phone numbers", async () => {
  const { stripContacts } = await import("../measure.mjs");
  assert.equal(stripContacts("Visit vibenplay.fun today. Prices from $4.99 for version 2.0"), "Visit vibenplay.fun today. Prices from $4.99 for version 2.0");
  assert.equal(stripContacts("Serving Karachi 2010 - 2024 with love"), "Serving Karachi 2010 - 2024 with love");
  assert.equal(stripContacts("Open 9:00 - 17:00 daily. Call 0300 1234567 today."), "Open 9:00 - 17:00 daily.");
  assert.equal(stripContacts("WhatsApp us on +923001234567. We deliver."), "We deliver.");
});
