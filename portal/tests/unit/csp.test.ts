import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

describe("contentSecurityPolicy", () => {
  it("in production: nonce scripts only, no eval, pictures from Supabase, no framing", () => {
    const csp = contentSecurityPolicy("abc", "https://x.supabase.co", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("img-src 'self' blob: data: https://x.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("in development allows what Next.js's dev tools need", () => {
    const csp = contentSecurityPolicy("abc", "http://127.0.0.1:54321", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("makes a different nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
