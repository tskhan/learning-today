import { describe, expect, it } from "vitest";
import { greeting } from "@/lib/greeting";

const now = new Date("2026-11-24T12:00:00Z");

describe("dashboard greeting", () => {
  it("says Welcome on the day someone joins", () => {
    expect(greeting("Ayesha", "2026-11-24T11:58:00Z", now)).toBe("Welcome, Ayesha");
    expect(greeting("Ayesha", "2026-11-23T12:30:00Z", now)).toBe("Welcome, Ayesha");
  });
  it("says Welcome back from the next day on", () => {
    expect(greeting("Ayesha", "2026-11-23T11:59:00Z", now)).toBe("Welcome back, Ayesha");
    expect(greeting("Ayesha", "2026-10-18T09:00:00Z", now)).toBe("Welcome back, Ayesha");
  });
});
