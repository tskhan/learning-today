import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_BUCKET } from "@/lib/images";

/** How long a picture link works. Pages are rendered per visit, so links are always fresh. */
const LINK_SECONDS = 60 * 60;

/**
 * Short-lived links for showing pictures. Only call this for a signed-in active member (every
 * portal page checks that first): the links are made with the secret key.
 */
export async function signedImageUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();
  const { data, error } = await createAdminClient().storage.from(IMAGE_BUCKET).createSignedUrls(unique, LINK_SECONDS);
  if (error) {
    console.error("signedImageUrls failed", error);
    return new Map();
  }
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

/** Deletes picture files that nothing uses any more. Best effort: a failure is logged, not shown. */
export async function removeImages(paths: string[]): Promise<void> {
  const unique = [...new Set(paths)].filter(Boolean);
  if (unique.length === 0) return;
  const { error } = await createAdminClient().storage.from(IMAGE_BUCKET).remove(unique);
  if (error) console.error("removeImages failed", error);
}
