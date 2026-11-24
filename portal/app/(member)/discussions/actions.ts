"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireMember } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { field, safeNext, type FormState } from "@/lib/forms";
import { LIMITS } from "@/lib/limits";
import { withError } from "@/lib/flash";
import { droppedImages, parseImageList } from "@/lib/images";
import { removeImages } from "@/lib/images-server";

function checkTitle(raw: string): { value?: string; error?: string } {
  const value = raw.trim();
  if (!value) return { error: "Give your discussion a title." };
  if (value.length > LIMITS.title) return { error: `Titles can be up to ${LIMITS.title} characters.` };
  return { value };
}

/** A message's text. Replies may be pictures only (`allowEmpty`), like a photo without a caption. */
function checkBody(raw: string, allowEmpty = false): { value?: string; error?: string } {
  const value = raw.trim();
  if (!value && !allowEmpty) return { error: "Write a message first." };
  if (value.length > LIMITS.body) return { error: `Messages can be up to ${LIMITS.body.toLocaleString("en")} characters.` };
  return { value };
}

function refresh(...paths: string[]) {
  revalidatePath("/discussions");
  revalidatePath("/");
  for (const p of paths) revalidatePath(p);
}

export async function createThread(_prev: FormState, fd: FormData): Promise<FormState> {
  const member = await requireMember();
  const title = checkTitle(field(fd, "title"));
  if (title.error) return { error: title.error };
  const body = checkBody(field(fd, "body"));
  if (body.error) return { error: body.error };
  const images = parseImageList(field(fd, "images"), member.id);
  if ("error" in images) return { error: images.error };
  const classIdRaw = field(fd, "class_id");
  const classId = classIdRaw ? Number(classIdRaw) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .insert({ title: title.value, body_md: body.value, images: images.value, class_id: Number.isFinite(classId) ? classId : null })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyError(error) };
  refresh();
  redirect(`/discussions/${data.id}`);
}

export async function replyToThread(_prev: FormState, fd: FormData): Promise<FormState> {
  const member = await requireMember();
  const threadId = Number(field(fd, "thread_id"));
  const returnTo = safeNext(fd.get("return_to"));
  const images = parseImageList(field(fd, "images"), member.id);
  if ("error" in images) return { error: images.error };
  const body = checkBody(field(fd, "body"), images.value.length > 0);
  if (body.error) return { error: body.error === "Write a message first." ? "Write a message or add a picture first." : body.error };
  const replyToRaw = Number(field(fd, "reply_to"));
  const replyTo = Number.isInteger(replyToRaw) && replyToRaw > 0 ? replyToRaw : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({ thread_id: threadId, body_md: body.value, images: images.value, reply_to: replyTo, quoted: replyTo !== null })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyError(error) };
  refresh(`/discussions/${threadId}`, returnTo);
  // Back to the discussion without the quote, scrolled to the new reply.
  redirect(`${returnTo}#post-${data.id}`);
}

export async function editPost(_prev: FormState, fd: FormData): Promise<FormState> {
  const member = await requireMember();
  const kind = field(fd, "kind");
  const id = Number(field(fd, "id"));
  const returnTo = safeNext(fd.get("return_to"));
  const images = parseImageList(field(fd, "images"), member.id);
  if ("error" in images) return { error: images.error };
  const body = checkBody(field(fd, "body"), kind !== "thread" && images.value.length > 0);
  if (body.error) return { error: body.error };
  const supabase = await createClient();
  const table = kind === "thread" ? "threads" : "posts";
  const { data: before } = await supabase.from(table).select("images").eq("id", id).maybeSingle<{ images: string[] }>();

  let result;
  if (kind === "thread") {
    const title = checkTitle(field(fd, "title"));
    if (title.error) return { error: title.error };
    result = await supabase.from("threads").update({ title: title.value, body_md: body.value, images: images.value }).eq("id", id).select("id");
  } else {
    result = await supabase.from("posts").update({ body_md: body.value, images: images.value }).eq("id", id).select("id");
  }
  if (result.error) return { error: friendlyError(result.error) };
  if (!result.data?.length) return { error: "You can only edit your own posts." };
  await removeImages(droppedImages(before?.images ?? [], images.value));
  refresh(returnTo);
  redirect(`${returnTo}#${kind === "thread" ? "thread" : "post"}-${id}`);
}

export async function deletePost(fd: FormData): Promise<void> {
  await requireMember();
  const kind = field(fd, "kind");
  const id = Number(field(fd, "id"));
  const returnTo = safeNext(fd.get("return_to"));
  const supabase = await createClient();
  // The pictures of what's being deleted (for a discussion: its own and all its replies'),
  // so their files can be deleted too.
  const pictures: string[] = [];
  if (kind === "thread") {
    const { data: t } = await supabase.from("threads").select("images").eq("id", id).maybeSingle<{ images: string[] }>();
    const { data: ps } = await supabase.from("posts").select("images").eq("thread_id", id).returns<Array<{ images: string[] }>>();
    pictures.push(...(t?.images ?? []), ...(ps ?? []).flatMap((p) => p.images));
  } else {
    const { data: p } = await supabase.from("posts").select("images").eq("id", id).maybeSingle<{ images: string[] }>();
    pictures.push(...(p?.images ?? []));
  }
  // Row-level security quietly skips rows you may not delete, so check that one was deleted.
  const { data, error } = kind === "thread"
    ? await supabase.from("threads").delete().eq("id", id).select("id")
    : await supabase.from("posts").delete().eq("id", id).select("id");
  if (error) redirect(withError(returnTo, "save_failed"));
  if (!data?.length) redirect(withError(returnTo, "not_yours"));
  await removeImages(pictures);
  if (kind === "thread") {
    refresh();
    redirect("/discussions");
  }
  refresh(returnTo);
  redirect(returnTo);
}

export async function setPinned(fd: FormData): Promise<void> {
  await requireAdmin();
  const threadId = Number(field(fd, "thread_id"));
  const pinned = field(fd, "pinned") === "true";
  const { data, error } = await createAdminClient().from("threads").update({ pinned }).eq("id", threadId).select("id");
  if (error) redirect(withError(`/discussions/${threadId}`, "save_failed"));
  if (!data?.length) redirect(withError("/discussions", "gone"));
  refresh(`/discussions/${threadId}`);
}
