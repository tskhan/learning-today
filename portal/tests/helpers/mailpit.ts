const MAILPIT = "http://127.0.0.1:54324";

interface Summary { ID: string; To: Array<{ Address: string }>; Created: string }

/** Polls the local inbox for the newest email to `email` and returns its first link containing `pathFragment`. */
export async function latestLinkTo(email: string, pathFragment: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    const match = messages.find((m) => m.To.some((t) => t.Address.toLowerCase() === email.toLowerCase()));
    if (match) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as { HTML: string; Text: string };
      const links = [...(full.HTML ?? "").matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      const link = links.find((l) => l.includes(pathFragment));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${email} with a link to ${pathFragment}`);
}
