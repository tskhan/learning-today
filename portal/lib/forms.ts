export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const BASE = "https://portal.invalid";

/**
 * Only same-site paths are allowed as a destination after login or a reset link.
 * Control characters and backslashes are refused outright (browsers strip or
 * reinterpret them, which can turn "/\t/evil.dev" into "//evil.dev"), and the
 * result is re-checked by resolving it against a fixed origin.
 */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string {
  const next = typeof value === "string" ? value : "";
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  return url.pathname + url.search + url.hash;
}

export function field(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === "string" ? value : "";
}
