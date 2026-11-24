"use server";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET, IMAGE_TYPES, isImagePath, MAX_IMAGE_BYTES, MAX_UPLOADS_PER_HOUR, sniffImageType, type AttachedImage } from "@/lib/images";
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
  // The type the browser sent is only a label: the file must really be that kind of picture.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffImageType(bytes) !== file.type) return { error: "Only pictures can be added (JPG, PNG or WebP)." };

  const supabase = await createClient();
  // At most MAX_UPLOADS_PER_HOUR uploads an hour per member, counted from their own folder.
  const { data: recent } = await supabase.storage
    .from(IMAGE_BUCKET)
    .list(member.id, { limit: MAX_UPLOADS_PER_HOUR, sortBy: { column: "created_at", order: "desc" } });
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const lastHour = (recent ?? []).filter((o) => o.created_at && Date.parse(o.created_at) > hourAgo).length;
  if (lastHour >= MAX_UPLOADS_PER_HOUR) return { error: "You've added a lot of pictures in the last hour. Please try again later." };

  const path = `${member.id}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: file.type });
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
