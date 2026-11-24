"use server";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET, IMAGE_TYPES, isImagePath, MAX_IMAGE_BYTES, type AttachedImage } from "@/lib/images";
import { signedImageUrls } from "@/lib/images-server";

/**
 * Uploads one picture (already shrunk in the browser) into the member's own folder. The upload
 * runs with the member's own login, so the storage rules apply: members only, own folder only.
 */
export async function uploadImage(fd: FormData): Promise<AttachedImage | { error: string }> {
  const member = await requireMember();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a picture first." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Only pictures can be added (JPG, PNG or WebP)." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That picture is too large. Try a smaller one or a screenshot." };

  const path = `${member.id}/${randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
  if (error) {
    console.error("uploadImage failed", error);
    return { error: "That picture couldn't be uploaded. Please try again." };
  }
  const url = (await signedImageUrls([path])).get(path) ?? "";
  return { path, url };
}

/** Deletes a picture the member added and then removed before sending. Only their own. */
export async function discardImage(path: string): Promise<void> {
  const member = await requireMember();
  if (!isImagePath(path, member.id)) return;
  const supabase = await createClient();
  await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}
