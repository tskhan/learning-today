import { describe, expect, it } from "vitest";
import { buildClassEmail } from "@/lib/class-email";
import { isNewClass } from "@/lib/status";

const cls = {
  number: 7,
  title: "Agents & <tools>",
  classDate: "2026-11-29",
  summaryMd: "## Topics\n\n- **Agents** in practice\n- <script>alert(1)</script>",
  homework: [
    { title: "Build an agent", deadline: "2026-12-06T18:59:00.000Z" },
    { title: "Read chapter 3", deadline: null },
  ],
};

describe("new class email", () => {
  const email = buildClassEmail(cls, "https://portal.learning-today.com");
  it("names the class in the subject and links to its guide", () => {
    expect(email.subject).toBe("Class 7 guide is up: Agents & <tools>");
    expect(email.text).toContain("Read the guide: https://portal.learning-today.com/classes/7");
    expect(email.html).toContain('href="https://portal.learning-today.com/classes/7"');
  });
  it("lists the homework with Pakistan-time deadlines", () => {
    expect(email.text).toContain("- Build an agent (due 6 Dec 2026, 11:59 pm Pakistan time)");
    expect(email.text).toContain("- Read chapter 3 (no deadline)");
  });
  it("escapes everything in the HTML and never includes scripts", () => {
    expect(email.html).toContain("Agents &amp; &lt;tools&gt;");
    expect(email.html).not.toContain("<script");
    expect(email.html).not.toContain("<tools>");
  });
  it("says how to turn the emails off", () => {
    expect(email.text).toContain("https://portal.learning-today.com/profile#emails");
    expect(email.html).toContain("Turn these emails off in your profile");
  });
});

describe("New badge", () => {
  const now = new Date("2026-11-30T12:00:00Z");
  it("shows for a week after publishing, until the member reviews the class", () => {
    expect(isNewClass({ id: 1, publishedAt: "2026-11-29T10:00:00Z" }, new Set(), now)).toBe(true);
    expect(isNewClass({ id: 1, publishedAt: "2026-11-29T10:00:00Z" }, new Set([1]), now)).toBe(false);
    expect(isNewClass({ id: 1, publishedAt: "2026-11-22T10:00:00Z" }, new Set(), now)).toBe(false);
    expect(isNewClass({ id: 1, publishedAt: null }, new Set(), now)).toBe(false);
  });
});
