import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRelative, isoToKarachiInput, karachiInputToISO } from "@/lib/time";

describe("Pakistan time", () => {
  it("converts a deadline typed in Pakistan time to UTC", () => {
    expect(karachiInputToISO("2026-11-30T23:59")).toBe("2026-11-30T18:59:00.000Z");
  });
  it("accepts a deadline that the browser sent with seconds", () => {
    expect(karachiInputToISO("2026-11-30T23:59:00")).toBe("2026-11-30T18:59:00.000Z");
    expect(karachiInputToISO("2026-11-30T23:59:30.000")).toBe("2026-11-30T18:59:30.000Z");
    expect(() => karachiInputToISO("2026-11-30T23:59:5")).toThrow();
  });
  it("converts back for edit forms", () => {
    expect(isoToKarachiInput("2026-11-30T18:59:00.000Z")).toBe("2026-11-30T23:59");
    expect(isoToKarachiInput("2026-11-30T20:30:00+00:00")).toBe("2026-12-01T01:30");
  });
  it("rejects bad input", () => {
    expect(() => karachiInputToISO("tomorrow")).toThrow();
  });
  it("formats dates and times for people", () => {
    expect(formatDateTime("2026-11-30T18:59:00.000Z")).toBe("30 Nov 2026, 11:59 pm");
    expect(formatDateTime("2026-12-01T04:05:00.000Z")).toBe("1 Dec 2026, 9:05 am");
    expect(formatDate("2026-11-15")).toBe("15 Nov 2026");
    expect(formatDate("2026-11-30T20:00:00.000Z")).toBe("1 Dec 2026");
  });
  it("formats relative times", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(formatRelative("2026-11-22T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-11-22T11:55:00Z", now)).toBe("5 min ago");
    expect(formatRelative("2026-11-22T09:00:00Z", now)).toBe("3 h ago");
    expect(formatRelative("2026-11-18T09:00:00Z", now)).toBe("18 Nov 2026");
  });
});
