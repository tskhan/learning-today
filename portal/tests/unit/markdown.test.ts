import { describe, expect, it } from "vitest";
import { excerpt, renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders formatting and strips scripts", () => {
    const html = renderMarkdown("<script>alert(1)</script>\n\n**hi**");
    expect(html).not.toContain("<script");
    expect(html).toContain("<strong>hi</strong>");
  });
  it("drops javascript: links", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
  });
  it("drops images and event handlers", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });
  it("opens links in a new tab safely", () => {
    const html = renderMarkdown("[a](https://a.dev)");
    expect(html).toContain('href="https://a.dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener nofollow"');
  });
  it("turns a top heading into h2", () => {
    expect(renderMarkdown("# Title")).toContain("<h2>Title</h2>");
  });
  it("keeps lists and line breaks", () => {
    const html = renderMarkdown("- one\n- two\n\nline a\nline b");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<br");
  });
});

describe("editor output", () => {
  it("keeps underline from the editor, and nothing else in that tag", () => {
    expect(renderMarkdown("<u>lined</u> text")).toBe("<p><u>lined</u> text</p>");
    expect(renderMarkdown('<u onclick="x()">lined</u>')).toBe("<p><u>lined</u></p>");
  });
  it("never lets a picture into the text (pictures are attachments)", () => {
    expect(renderMarkdown("![x](https://evil.example/x.png)")).not.toContain("<img");
  });
});

describe("excerpt for quoting", () => {
  it("is plain, single-line text, shortened with an ellipsis", () => {
    expect(excerpt("**Bold** and <u>lined</u>\n\n- item")).toBe("Bold and lined item");
    expect(excerpt("x".repeat(200), 20)).toBe(`${"x".repeat(19)}…`);
    expect(excerpt("a < b & c")).toBe("a < b & c");
    // Decoded once only: text that reads "&lt;" stays "&lt;".
    expect(excerpt("write `&lt;` for <")).toBe("write &lt; for <");
  });
});
