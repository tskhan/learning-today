/**
 * Pictures attached to messages and class guides. Shared by the browser and the server: the
 * rules here match the database's valid_image_paths() check (migration 20261124000002).
 */
export const IMAGE_BUCKET = "post-images";
export const MAX_IMAGES = 4;
/** After shrinking in the browser; the bucket itself refuses anything over 2 MB. */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
/** Longest side, in pixels, after shrinking. */
export const MAX_IMAGE_SIDE = 1600;
export const IMAGE_TYPES: Record<string, "webp" | "jpg" | "png"> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** A picture as the compose box keeps it: the stored path, and a short-lived link to show it. */
export interface AttachedImage { path: string; url: string }

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

/** "<user id>/<random id>.<ext>"; with `owner`, the picture must be in that user's folder. */
export function isImagePath(path: string, owner?: string): boolean {
  return PATH_RE.test(path) && (!owner || path.split("/")[0] === owner);
}

/**
 * Reads a picture list sent by a form: a JSON array of paths or of { path, url } objects.
 * Returns the paths, or an error message for people.
 */
export function parseImageList(raw: string, owner?: string): { value: string[] } | { error: string } {
  if (!raw.trim()) return { value: [] };
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { error: "Those pictures couldn't be read. Remove them and add them again." };
  }
  if (!Array.isArray(list)) return { error: "Those pictures couldn't be read. Remove them and add them again." };
  const paths = list.map((x) => (typeof x === "string" ? x : typeof x === "object" && x && "path" in x ? String((x as { path: unknown }).path) : ""));
  if (paths.length > MAX_IMAGES) return { error: `You can add up to ${MAX_IMAGES} pictures.` };
  if (paths.some((p) => !isImagePath(p, owner))) return { error: "One of the pictures isn't valid. Remove it and add it again." };
  return { value: [...new Set(paths)] };
}

/** Pictures in `before` that are not in `after`: their files can be deleted. */
export function droppedImages(before: string[], after: string[]): string[] {
  const keep = new Set(after);
  return before.filter((p) => !keep.has(p));
}
