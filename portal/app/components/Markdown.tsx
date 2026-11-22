import { renderMarkdown } from "@/lib/markdown";

/** The only place raw HTML is injected: always passed through the sanitising renderer. */
export function Markdown({ md }: { md: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />;
}
