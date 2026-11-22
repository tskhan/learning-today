import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

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
