import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

describe("normalizeSupabaseUrl", () => {
  it("keeps a plain project URL", () => {
    expect(normalizeSupabaseUrl("https://abcd.supabase.co")).toBe("https://abcd.supabase.co");
  });
  it("strips the REST path, trailing slashes and spaces people paste by mistake", () => {
    expect(normalizeSupabaseUrl(" https://abcd.supabase.co/rest/v1/ ")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/auth/v1")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });
});
