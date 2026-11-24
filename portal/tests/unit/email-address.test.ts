import { describe, expect, it } from "vitest";
import { isEmail, MAX_EMAIL_LENGTH } from "@/lib/email-address";

describe("isEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isEmail("ali@example.com")).toBe(true);
    expect(isEmail("first.last+tag@mail.example.co.uk")).toBe(true);
  });
  it("refuses things that aren't addresses", () => {
    for (const bad of ["", "ali", "ali@", "@example.com", "ali@example", "ali @example.com", "a@b@c.com", "ali@example..com", "ali@.com"]) {
      expect(isEmail(bad), bad).toBe(false);
    }
  });
  it("refuses overlong input", () => {
    expect(isEmail(`${"a".repeat(MAX_EMAIL_LENGTH)}@x.com`)).toBe(false);
  });
  it("answers quickly on input built to make a pattern backtrack", () => {
    const start = performance.now();
    isEmail(`a@${"a.".repeat(5000)}`);
    isEmail(`${"@".repeat(1)}${"a".repeat(100)}.${"a.".repeat(120)}`);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
