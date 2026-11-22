import { describe, expect, it } from "vitest";
import { homeworkState, summarize, summaryLine, type ClassRef } from "@/lib/status";

const joined = "2026-10-01T00:00:00Z";

describe("homeworkState", () => {
  const deadline = "2026-11-30T18:59:00.000Z";
  it("is due until the deadline and overdue from the deadline", () => {
    expect(homeworkState({ deadline }, false, joined, new Date("2026-11-30T18:58:59Z"))).toBe("due");
    expect(homeworkState({ deadline }, false, joined, new Date("2026-11-30T18:59:00Z"))).toBe("overdue");
  });
  it("done wins", () => {
    expect(homeworkState({ deadline }, true, joined, new Date("2026-12-30T00:00:00Z"))).toBe("done");
  });
  it("no deadline is always due", () => {
    expect(homeworkState({ deadline: null }, false, joined, new Date("2030-01-01T00:00:00Z"))).toBe("due");
  });
  it("homework whose deadline passed before the student joined is catch-up", () => {
    expect(
      homeworkState({ deadline: "2026-11-01T00:00:00Z" }, false, "2026-11-20T00:00:00Z", new Date("2026-11-22T00:00:00Z")),
    ).toBe("catchup");
  });
});

function cls(id: number, homework: Array<{ id: number; deadline: string | null }>): ClassRef {
  return {
    id,
    number: id,
    title: `Class ${id}`,
    classDate: "2026-11-01",
    homework: homework.map((h) => ({ ...h, classId: id, classNumber: id, title: `HW ${h.id}`, handinExpected: false })),
  };
}

describe("summarize and summaryLine", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("splits due, overdue and catch-up", () => {
    const classes = [
      cls(1, [{ id: 11, deadline: "2026-11-25T00:00:00Z" }]),
      cls(2, [{ id: 21, deadline: "2026-11-21T00:00:00Z" }]),
      cls(3, [{ id: 31, deadline: "2026-11-02T00:00:00Z" }]),
    ];
    const p = summarize(classes, new Set([1, 2]), new Set(), "2026-11-10T00:00:00Z", now);
    expect(p.classesTotal).toBe(3);
    expect(p.classesReviewed).toBe(2);
    expect(p.due.map((h) => h.id)).toEqual([11]);
    expect(p.overdue.map((h) => h.id)).toEqual([21]);
    expect(p.catchup.map((h) => h.id)).toEqual([31]);
    expect(summaryLine(p)).toBe("2 of 3 classes reviewed · 1 homework due · 1 overdue");
  });
  it("sorts due by deadline with no-deadline items last", () => {
    const classes = [cls(1, [{ id: 1, deadline: null }, { id: 2, deadline: "2026-12-05T00:00:00Z" }, { id: 3, deadline: "2026-11-28T00:00:00Z" }])];
    const p = summarize(classes, new Set(), new Set(), joined, now);
    expect(p.due.map((h) => h.id)).toEqual([3, 2, 1]);
  });
  it("says all homework done when everything is done", () => {
    const classes = [cls(1, [{ id: 1, deadline: null }]), cls(2, []), cls(3, [])];
    const p = summarize(classes, new Set([1, 2, 3]), new Set([1]), joined, now);
    expect(p.doneCount).toBe(1);
    expect(summaryLine(p)).toBe("3 of 3 classes reviewed · all homework done");
  });
  it("leaves homework out when there is none", () => {
    const classes = [1, 2, 3, 4, 5, 6].map((i) => cls(i, []));
    expect(summaryLine(summarize(classes, new Set(), new Set(), joined, now))).toBe("0 of 6 classes reviewed");
  });
});
