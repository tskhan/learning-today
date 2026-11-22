"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireMember } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { field, safeNext, type FormState } from "@/lib/forms";
import { LIMITS } from "@/lib/limits";

function checkTitle(raw: string): { value?: string; error?: string } {
  const value = raw.trim();
  if (!value) return { error: "Give your discussion a title." };
  if (value.length > LIMITS.title) return { error: `Titles can be up to ${LIMITS.title} characters.` };
  return { value };
}

function checkBody(raw: string): { value?: string; error?: string } {
  const value = raw.trim();
  if (!value) return { error: "Write a message first." };
  if (value.length > LIMITS.body) return { error: `Messages can be up to ${LIMITS.body.toLocaleString("en")} characters.` };
  return { value };
}

function refresh(...paths: string[]) {
  revalidatePath("/discussions");
  revalidatePath("/");
  for (const p of paths) revalidatePath(p);
}

export async function createThread(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const title = checkTitle(field(fd, "title"));
  if (title.error) return { error: title.error };
  const body = checkBody(field(fd, "body"));
  if (body.error) return { error: body.error };
  const classIdRaw = field(fd, "class_id");
  const classId = classIdRaw ? Number(classIdRaw) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .insert({ title: title.value, body_md: body.value, class_id: Number.isFinite(classId) ? classId : null })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyError(error) };
  refresh();
  redirect(`/discussions/${data.id}`);
}

export async function replyToThread(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const threadId = Number(field(fd, "thread_id"));
  const body = checkBody(field(fd, "body"));
  if (body.error) return { error: body.error };
  const supabase = await createClient();
  const { error } = await supabase.from("posts").insert({ thread_id: threadId, body_md: body.value });
  if (error) return { error: friendlyError(error) };
  refresh(`/discussions/${threadId}`, safeNext(fd.get("return_to")));
  return { ok: "Reply posted." };
}

export async function editPost(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const kind = field(fd, "kind");
  const id = Number(field(fd, "id"));
  const returnTo = safeNext(fd.get("return_to"));
  const body = checkBody(field(fd, "body"));
  if (body.error) return { error: body.error };
  const supabase = await createClient();

  let result;
  if (kind === "thread") {
    const title = checkTitle(field(fd, "title"));
    if (title.error) return { error: title.error };
    result = await supabase.from("threads").update({ title: title.value, body_md: body.value }).eq("id", id).select("id");
  } else {
    result = await supabase.from("posts").update({ body_md: body.value }).eq("id", id).select("id");
  }
  if (result.error) return { error: friendlyError(result.error) };
  if (!result.data?.length) return { error: "You can only edit your own posts." };
  refresh(returnTo);
  redirect(returnTo);
}

export async function deletePost(fd: FormData): Promise<void> {
  await requireMember();
  const kind = field(fd, "kind");
  const id = Number(field(fd, "id"));
  const returnTo = safeNext(fd.get("return_to"));
  const supabase = await createClient();
  if (kind === "thread") {
    await supabase.from("threads").delete().eq("id", id);
    refresh();
    redirect("/discussions");
  }
  await supabase.from("posts").delete().eq("id", id);
  refresh(returnTo);
  redirect(returnTo);
}

export async function setPinned(fd: FormData): Promise<void> {
  await requireAdmin();
  const threadId = Number(field(fd, "thread_id"));
  const pinned = field(fd, "pinned") === "true";
  await createAdminClient().from("threads").update({ pinned }).eq("id", threadId);
  refresh(`/discussions/${threadId}`);
}
