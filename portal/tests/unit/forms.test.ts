import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/forms";

describe("safeNext", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNext("/classes")).toBe("/classes");
    expect(safeNext("/classes/5?edit=hw-1#hw-1")).toBe("/classes/5?edit=hw-1#hw-1");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.dev", "//evil.dev", "/\\evil.dev", "/\t/evil.dev", "/\n/evil.dev", "/\r/evil.dev",
      "\t//evil.dev", " //evil.dev", "/%09/evil.dev", "javascript:alert(1)", "", null, undefined,
    ]) {
      const out = safeNext(bad as string);
      expect(new URL(out, "https://portal.learning-today.com").origin, String(bad)).toBe("https://portal.learning-today.com");
      expect(out.startsWith("/"), String(bad)).toBe(true);
      expect(out.startsWith("//"), String(bad)).toBe(false);
    }
  });
  it("falls back to the dashboard for off-site values", () => {
    expect(safeNext("/\t/evil.dev")).toBe("/");
    expect(safeNext("https://evil.dev/x")).toBe("/");
  });
});
