import { describe, expect, it } from "vitest";
import { ipFromHeaders, JOIN_CODE_LIMIT } from "@/lib/signup-throttle";

const h = (values: Record<string, string>) => new Headers(values);

describe("ipFromHeaders", () => {
  it("uses the first x-forwarded-for entry (the visitor, on Vercel)", () => {
    expect(ipFromHeaders(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(ipFromHeaders(h({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(ipFromHeaders(h({}))).toBe("unknown");
  });
  it("allows a few typos but not a guessing run", () => {
    expect(JOIN_CODE_LIMIT.attempts).toBeGreaterThanOrEqual(5);
    expect(JOIN_CODE_LIMIT.attempts).toBeLessThanOrEqual(20);
  });
});
