"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { cleanText, LIMITS } from "@/lib/limits";
import { field, type FormState } from "@/lib/forms";

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const member = await requireMember();
  const fullName = cleanText(field(fd, "full_name"), LIMITS.name);
  if (!fullName) return { error: `Enter your full name (up to ${LIMITS.name} characters).` };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", member.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: "Name saved." };
}
