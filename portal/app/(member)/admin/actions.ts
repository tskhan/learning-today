"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { field, type FormState } from "@/lib/forms";
import { LIMITS, validateHttpUrl } from "@/lib/limits";
import { renderMarkdown } from "@/lib/markdown";
import { withError } from "@/lib/flash";
import { karachiInputToISO } from "@/lib/time";

function all(fd: FormData, name: string): string[] {
  return fd.getAll(name).map((v) => (typeof v === "string" ? v : ""));
}

function refreshClasses() {
  revalidatePath("/", "layout");
}

/** Renders a Markdown preview for the class form. */
export async function previewMarkdown(md: string): Promise<string> {
  await requireAdmin();
  return renderMarkdown(md);
}

interface HomeworkInput { id: number | null; title: string; instructions_md: string; deadline: string | null; handin_expected: boolean; position: number }

export async function saveClass(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const idRaw = field(fd, "id");
  const id = idRaw ? Number(idRaw) : null;
  const number = Number(field(fd, "number"));
  const classDate = field(fd, "class_date");
  const title = field(fd, "title").trim();
  const summary = field(fd, "summary_md");
  const status = field(fd, "status") === "published" ? "published" : "draft";

  if (!Number.isInteger(number) || number <= 0) return { error: "Enter the class number (1, 2, 3…)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate)) return { error: "Enter the class date." };
  if (!title) return { error: "Give the class a title." };
  if (title.length > LIMITS.title) return { error: `Titles can be up to ${LIMITS.title} characters.` };

  const materials: Array<{ label: string; url: string; position: number }> = [];
  const labels = all(fd, "material_label");
  const urls = all(fd, "material_url");
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim();
    const rawUrl = (urls[i] ?? "").trim();
    if (!label && !rawUrl) continue;
    const url = validateHttpUrl(rawUrl);
    if (!label) return { error: `Material ${i + 1} needs a label.` };
    if (label.length > LIMITS.title) return { error: `Material labels can be up to ${LIMITS.title} characters.` };
    if (!url) return { error: `Material "${label}" needs a link starting with http:// or https://` };
    materials.push({ label, url, position: materials.length });
  }

  const homework: HomeworkInput[] = [];
  const hwIds = all(fd, "hw_id");
  const hwTitles = all(fd, "hw_title");
  const hwInstructions = all(fd, "hw_instructions");
  const hwDeadlines = all(fd, "hw_deadline");
  const hwHandins = all(fd, "hw_handin");
  for (let i = 0; i < hwTitles.length; i++) {
    const hwTitle = hwTitles[i].trim();
    const instructions = hwInstructions[i] ?? "";
    const deadlineRaw = (hwDeadlines[i] ?? "").trim();
    if (!hwTitle && !instructions.trim() && !deadlineRaw && !hwIds[i]) continue;
    if (!hwTitle) return { error: `Homework ${i + 1} needs a title.` };
    if (hwTitle.length > LIMITS.title) return { error: `Homework titles can be up to ${LIMITS.title} characters.` };
    let deadline: string | null = null;
    if (deadlineRaw) {
      try {
        deadline = karachiInputToISO(deadlineRaw);
      } catch {
        return { error: `The deadline for "${hwTitle}" isn't a valid date and time.` };
      }
    }
    homework.push({
      id: hwIds[i] ? Number(hwIds[i]) : null,
      title: hwTitle,
      instructions_md: instructions,
      deadline,
      handin_expected: hwHandins[i] === "yes",
      position: homework.length,
    });
  }

  // One database call, one transaction: if any part fails, nothing is saved.
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_class", {
    p_id: id,
    p_number: number,
    p_class_date: classDate,
    p_title: title,
    p_summary_md: summary,
    p_status: status,
    p_materials: materials,
    p_homework: homework,
  });
  if (error) {
    if (error.code === "23505") return { error: `Class ${number} already exists.` };
    if (error.code === "P0002") return { error: "That class no longer exists. Go back to Classes and start again." };
    if (error.code === "PGRST202") {
      console.error("saveClass: save_class() is missing; run the latest SQL file from portal/SETUP.md", error);
      return { error: "The database needs its latest update before classes can be saved. See portal/SETUP.md." };
    }
    return { error: friendlyError(error) };
  }

  refreshClasses();
  redirect("/admin/classes");
}

export async function setClassStatus(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(field(fd, "id"));
  const status = field(fd, "status") === "published" ? "published" : "draft";
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").update({ status }).eq("id", id).select("id");
  if (error) redirect(withError("/admin/classes", "save_failed"));
  if (!data?.length) redirect(withError("/admin/classes", "gone"));
  refreshClasses();
}

export async function deleteClass(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(field(fd, "id"));
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("number").eq("id", id).maybeSingle();
  if (!cls) return { error: "That class no longer exists." };
  if (field(fd, "confirm").trim() !== String(cls.number)) return { error: `Type ${cls.number} to confirm.` };
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  refreshClasses();
  redirect("/admin/classes");
}

function refreshMembers() {
  revalidatePath("/admin/members");
}

export async function setMemberStatus(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const userId = field(fd, "user_id");
  const status = field(fd, "status") === "removed" ? "removed" : "active";
  if (userId === me.id) redirect(withError("/admin/members", "self"));
  const admin = createAdminClient();
  // Block or unblock their login first; only then change the profile, so the two never disagree.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: status === "removed" ? "876000h" : "none" });
  if (banError) redirect(withError("/admin/members", banError.status === 404 ? "gone" : "save_failed"));
  const { data, error } = await admin.from("profiles").update({ status }).eq("id", userId).select("id");
  if (error || !data?.length) {
    await admin.auth.admin.updateUserById(userId, { ban_duration: status === "removed" ? "none" : "876000h" });
    redirect(withError("/admin/members", error ? "save_failed" : "gone"));
  }
  refreshMembers();
}

export async function setMemberRole(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const userId = field(fd, "user_id");
  const role = field(fd, "role") === "admin" ? "admin" : "student";
  if (userId === me.id) redirect(withError("/admin/members", "self"));
  const { data, error } = await createAdminClient().from("profiles").update({ role }).eq("id", userId).select("id");
  if (error) redirect(withError("/admin/members", "save_failed"));
  if (!data?.length) redirect(withError("/admin/members", "gone"));
  refreshMembers();
}

export async function resetLink(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = field(fd, "user_id");
  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const email = user?.user?.email;
  if (!email) return { error: "That member no longer exists." };
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) return { error: "Couldn't make a reset link. Please try again." };
  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`;
  return { ok: link };
}

export async function deleteMember(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const userId = field(fd, "user_id");
  if (userId === me.id) return { error: "You can't delete your own account here." };
  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const email = user?.user?.email ?? "";
  if (field(fd, "confirm").trim().toLowerCase() !== email.toLowerCase()) return { error: "Type their email exactly to confirm." };
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Couldn't delete this member. Please try again." };
  refreshMembers();
  revalidatePath("/discussions");
  return { ok: "Deleted." };
}

export async function saveJoinCode(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const code = field(fd, "join_code").trim();
  if (code.length < LIMITS.joinCodeMin || code.length > LIMITS.joinCodeMax || /\s/.test(code)) {
    return { error: `Use ${LIMITS.joinCodeMin}–${LIMITS.joinCodeMax} characters with no spaces.` };
  }
  const { error } = await createAdminClient().from("settings").update({ join_code: code }).eq("id", 1);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/settings");
  return { ok: "Join code saved." };
}
