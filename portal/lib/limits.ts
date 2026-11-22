export const LIMITS = { name: 80, title: 150, body: 5000, note: 500, joinCodeMin: 4, joinCodeMax: 64 } as const;

/** The trimmed URL if it is a valid http(s) URL, otherwise null. */
export function validateHttpUrl(input: string): string | null {
  const value = (input ?? "").trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return value;
  } catch {
    return null;
  }
}

/** Trimmed text, or null when it is empty, not a string, or longer than max. */
export function cleanText(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (value.length === 0 || value.length > max) return null;
  return value;
}
