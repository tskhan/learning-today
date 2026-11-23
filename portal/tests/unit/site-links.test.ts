import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const PAGES = ["index.html", "admin-links.html", "student-websites.html", "make-videos-with-claude.html", "privacy.html"];

describe("main site links to the portal", () => {
  it.each(PAGES)("%s has exactly one Batch portal link in its menu", (file) => {
    const html = read(file);
    const menu = html.match(/<ul id="site-menu"[\s\S]*?<\/ul>\s*<\/nav>/)?.[0] ?? "";
    expect(menu.match(/href="https:\/\/portal\.learning-today\.com\/"/g)?.length).toBe(1);
  });

  it("home page has a Batch 91 Portal card", () => {
    expect(read("index.html")).toContain("Batch 91 Portal");
  });

  it("robots.txt keeps search engines out of the portal source and docs", () => {
    const robots = read("robots.txt");
    expect(robots).toContain("Disallow: /portal/");
    expect(robots).toContain("Disallow: /docs/");
  });

  it("sitemap does not list the portal", () => {
    expect(read("sitemap.xml")).not.toContain("portal");
  });

  it("privacy page explains the portal", () => {
    expect(read("privacy.html")).toContain("The Batch 91 Portal");
  });
});
