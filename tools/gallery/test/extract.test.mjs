import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseChat, mergeLinks, lastMessageDate } from "../extract.mjs";

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const EXPECTED = [
  { url: "https://ali-demo.lovable.app", date: "2026-10-20" },
  { url: "https://sara-shop.vercel.app", date: "2026-10-20" },
  { url: "https://ali-demo.lovable.app", date: "2026-10-22" },
  { url: "https://bilal-portfolio.netlify.app", date: "2026-10-22" },
  { url: "https://share.google/AbC123", date: "2026-10-23" },
];

test("Android, iPhone and month-first exports give the same links and dates", () => {
  assert.deepEqual(parseChat(fixture("chat-android.txt")), EXPECTED);
  assert.deepEqual(parseChat(fixture("chat-iphone.txt")), EXPECTED);
  assert.deepEqual(parseChat(fixture("chat-monthfirst.txt")), EXPECTED);
});

test("repeat posts collapse into one link with first and last dates and a count", () => {
  const { links, added } = mergeLinks({ exportDate: "2026-10-01", links: [] }, EXPECTED, []);
  assert.deepEqual(links.find((l) => l.url === "https://ali-demo.lovable.app"),
    { url: "https://ali-demo.lovable.app", firstPosted: "2026-10-20", lastPosted: "2026-10-22", times: 2 });
  assert.equal(links.length, 4);
  assert.deepEqual(added.sort(), ["https://ali-demo.lovable.app", "https://bilal-portfolio.netlify.app", "https://sara-shop.vercel.app", "https://share.google/AbC123"]);
});

test("existing links keep their earliest date; removed links are skipped", () => {
  const existing = { exportDate: "2026-10-21", links: [{ url: "https://ali-demo.lovable.app", firstPosted: "2026-10-18", lastPosted: "2026-10-18", times: 1 },
    { url: "https://old.lovable.app", firstPosted: "2026-10-01", lastPosted: "2026-10-01", times: 1 }] };
  const { links, added, skipped } = mergeLinks(existing, EXPECTED, [{ url: "https://sara-shop.vercel.app", reason: "asked" }]);
  assert.equal(links.find((l) => l.url === "https://ali-demo.lovable.app").firstPosted, "2026-10-18");
  assert.equal(links.find((l) => l.url === "https://ali-demo.lovable.app").times, 2);
  assert.ok(links.some((l) => l.url === "https://old.lovable.app"));
  assert.ok(!links.some((l) => l.url === "https://sara-shop.vercel.app"));
  assert.equal(skipped, 1);
  assert.deepEqual(added.sort(), ["https://bilal-portfolio.netlify.app", "https://share.google/AbC123"]);
});

test("nothing from the chat but links and dates reaches the output", () => {
  const out = JSON.stringify(mergeLinks({ exportDate: "2026-10-01", links: [] }, parseChat(fixture("chat-android.txt")), []));
  for (const banned of ["Ali", "Sara Shop", "Bilal Sample", "Teacher", "+92", "0000000", "example.com", "please check"]) assert.ok(!out.includes(banned), banned);
});

test("the export date defaults to the last message's date, not the last link's", () => {
  const text = fixture("chat-android.txt") + "25/10/2026, 09:00 - Ali Example: thanks all\n";
  assert.equal(lastMessageDate(text), "2026-10-25");
  assert.equal(lastMessageDate(fixture("chat-monthfirst.txt")), "2026-10-23");
});
