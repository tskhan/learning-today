import type { AttachedImage } from "@/lib/images";

/** The pictures a form had when its action returned an error (kept as JSON), to put back. */
export function keptImages(raw: string | undefined): AttachedImage[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x) => x && typeof x.path === "string" && typeof x.url === "string") : [];
  } catch {
    return [];
  }
}
