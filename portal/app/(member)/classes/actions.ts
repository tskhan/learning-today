"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { field, safeNext, type FormState } from "@/lib/forms";
import { LIMITS, validateHttpUrl } from "@/lib/limits";

function refresh(returnTo: string) {
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath(returnTo);
}

export async function setReviewed(fd: FormData): Promise<void> {
  const member = await requireMember();
  const classId = Number(field(fd, "class_id"));
  const returnTo = safeNext(fd.get("return_to"));
  const supabase = await createClient();
  if (field(fd, "reviewed") === "true") {
    await supabase
      .from("class_reviews")
      .upsert({ user_id: member.id, class_id: classId }, { onConflict: "user_id,class_id", ignoreDuplicates: true });
  } else {
    await supabase.from("class_reviews").delete().eq("user_id", member.id).eq("class_id", classId);
  }
  refresh(returnTo);
}

export async function markHomework(_prev: FormState, fd: FormData): Promise<FormState> {
  const member = await requireMember();
  const homeworkId = Number(field(fd, "homework_id"));
  const returnTo = safeNext(fd.get("return_to"));
  const rawUrl = field(fd, "handin_url").trim();
  const note = field(fd, "note").trim();

  let handinUrl: string | null = null;
  if (rawUrl) {
    handinUrl = validateHttpUrl(rawUrl);
    if (!handinUrl) return { error: "Links must start with http:// or https://" };
  }
  if (note.length > LIMITS.note) return { error: `Notes can be up to ${LIMITS.note} characters.` };

  const supabase = await createClient();
  const { error } = await supabase.from("homework_status").upsert(
    { user_id: member.id, homework_id: homeworkId, handin_url: handinUrl, note: note || null, done_at: new Date().toISOString() },
    { onConflict: "user_id,homework_id" },
  );
  if (error) return { error: friendlyError(error) };
  refresh(returnTo);
  if (fd.get("editing") === "1") redirect(`${returnTo}#hw-${homeworkId}`);
  return { ok: "Saved." };
}

export async function unmarkHomework(fd: FormData): Promise<void> {
  const member = await requireMember();
  const homeworkId = Number(field(fd, "homework_id"));
  const returnTo = safeNext(fd.get("return_to"));
  const supabase = await createClient();
  await supabase.from("homework_status").delete().eq("user_id", member.id).eq("homework_id", homeworkId);
  refresh(returnTo);
}
