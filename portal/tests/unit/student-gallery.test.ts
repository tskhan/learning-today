import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkGallery, competitionRanks, roundHalfEven } from "../../../tools/check-student-gallery.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("student websites gallery (rules in docs/student-gallery.md)", () => {
  it("is internally consistent: counts, scores, ranks and tables", () => {
    const { problems } = checkGallery({ gallery: read("student-websites.html"), index: read("index.html"), readme: read("README.md") });
    expect(problems).toEqual([]);
  });

  it("ranks like sports tables: ties share a rank and the next rank skips", () => {
    expect(competitionRanks([90, 85, 85, 80])).toEqual([1, 2, 2, 4]);
  });

  it("rounds the overall score half to even", () => {
    expect(roundHalfEven(84.5)).toBe(84);
    expect(roundHalfEven(85.5)).toBe(86);
    expect(roundHalfEven(84.25)).toBe(84);
    expect(roundHalfEven(84.75)).toBe(85);
  });

  it("catches a rank counted over more sites than are rated", () => {
    const gallery = read("student-websites.html").replace(/Overall rank <b>#(\d+)<\/b> of \d+/, "Overall rank <b>#$1</b> of 175");
    const { problems } = checkGallery({ gallery });
    expect(problems.some((p) => p.includes("of 175, should be"))).toBe(true);
  });
});

describe("shared page parts", () => {
  it("refuses a gallery with an old site.js date or the Motion script", () => {
    const index = read("index.html");
    const gallery = read("student-websites.html");
    const oldScript = gallery.replace(/site\.js\?v=[^"]*/, "site.js?v=2000-01-01");
    expect(checkGallery({ gallery: oldScript, index }).problems.join(" ")).toMatch(/site\.js script tag/);
    const withMotion = gallery.replace("</body>", '<script src="https://cdn.jsdelivr.net/npm/motion@14.14.0/dist/motion.js"></script></body>');
    expect(checkGallery({ gallery: withMotion, index }).problems.join(" ")).toMatch(/jsDelivr/);
  });
});
