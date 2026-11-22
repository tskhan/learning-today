import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("main site and the portal", () => {
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
