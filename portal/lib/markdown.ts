import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown → HTML that is safe to inject: no scripts, images, styles or non-http links. Underline
 * comes from the editor as <u>…</u>, the one HTML tag allowed through. Pictures are never part of
 * the text: they are attachments, shown by PostImages.
 */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? "", { gfm: true, breaks: true, async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ["p", "br", "strong", "em", "u", "del", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h2", "h3", "h4", "hr"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener nofollow" },
      }),
    },
  }).trim();
}

/** Plain text of a message, shortened, for quoting it in a reply. */
export function excerpt(md: string, max = 120): string {
  const text = sanitizeHtml(renderMarkdown(md), { allowedTags: [], allowedAttributes: {} })
    // Decode &amp; last, so text such as "&amp;lt;" stays "&lt;" (no double unescaping).
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
