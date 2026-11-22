import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Markdown → HTML that is safe to inject: no scripts, images, styles or non-http links. */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? "", { gfm: true, breaks: true, async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ["p", "br", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h2", "h3", "h4", "hr"],
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
