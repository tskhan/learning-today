import { describe, expect, it } from "vitest";
import { cleanText, validateHttpUrl } from "@/lib/limits";

describe("validateHttpUrl", () => {
  it("accepts and trims http(s) URLs", () => {
    expect(validateHttpUrl("  https://x.dev/a ")).toBe("https://x.dev/a");
    expect(validateHttpUrl("http://x.dev")).toBe("http://x.dev");
  });
  it("rejects other schemes and junk", () => {
    expect(validateHttpUrl("javascript:alert(1)")).toBeNull();
    expect(validateHttpUrl("ftp://x")).toBeNull();
    expect(validateHttpUrl("not a url")).toBeNull();
    expect(validateHttpUrl("")).toBeNull();
  });
});

describe("cleanText", () => {
  it("trims and enforces length", () => {
    expect(cleanText("  hi  ", 5)).toBe("hi");
    expect(cleanText("   ", 5)).toBeNull();
    expect(cleanText("abcdef", 5)).toBeNull();
    expect(cleanText(null, 5)).toBeNull();
  });
});
