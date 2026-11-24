"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { field, type FormState } from "@/lib/forms";
import { LIMITS, validateHttpUrl } from "@/lib/limits";
import { withError } from "@/lib/flash";
import { droppedImages, parseImageList } from "@/lib/images";
import { removeImages } from "@/lib/images-server";
import { notifyNewClass } from "@/lib/notify";
import { karachiInputToISO } from "@/lib/time";

function all(fd: FormData, name: string): string[] {
  return fd.getAll(name).map((v) => (typeof v === "string" ? v : ""));
}

function refreshClasses() {
  revalidatePath("/", "layout");
}


interface HomeworkInput { id: number | null; title: string; instructions_md: string; images: string[]; deadline: string | null; handin_expected: boolean; position: number }

export async function saveClass(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
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
  const summaryImages = parseImageList(field(fd, "summary_images"));
  if ("error" in summaryImages) return { error: `Summary pictures: ${summaryImages.error}` };

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
  const hwImages = all(fd, "hw_images");
  for (let i = 0; i < hwTitles.length; i++) {
    const hwTitle = hwTitles[i].trim();
    const instructions = hwInstructions[i] ?? "";
    const deadlineRaw = (hwDeadlines[i] ?? "").trim();
    const pictures = parseImageList(hwImages[i] ?? "");
    if ("error" in pictures) return { error: `Homework ${i + 1} pictures: ${pictures.error}` };
    if (!hwTitle && !instructions.trim() && !deadlineRaw && !hwIds[i] && pictures.value.length === 0) continue;
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
      images: pictures.value,
      deadline,
      handin_expected: hwHandins[i] === "yes",
      position: homework.length,
    });
  }

  // One database call, one transaction: if any part fails, nothing is saved.
  const supabase = await createClient();
  const picturesBefore = id ? await classPictures(id) : [];
  const { data: savedId, error } = await supabase.rpc("save_class_with_images", {
    p_id: id,
    p_number: number,
    p_class_date: classDate,
    p_title: title,
    p_summary_md: summary,
    p_summary_images: summaryImages.value,
    p_status: status,
    p_materials: materials,
    p_homework: homework,
  });
  if (error) {
    if (error.code === "23505") return { error: `Class ${number} already exists.` };
    if (error.code === "P0002") return { error: "That class no longer exists. Go back to Classes and start again." };
    if (error.code === "PGRST202") {
      console.error("saveClass: save_class_with_images() is missing; run the latest SQL file from portal/SETUP.md", error);
      return { error: "The database needs its latest update before classes can be saved. See portal/SETUP.md." };
    }
    return { error: friendlyError(error) };
  }
  // Pictures taken out of the summary or homework (or with removed homework) are deleted.
  await removeImages(droppedImages(picturesBefore, [...summaryImages.value, ...homework.flatMap((h) => h.images)]));
  // The first time a class is published, email the members (after the page has answered).
  if (status === "published" && typeof savedId === "number") after(() => notifyNewClass(savedId, { exclude: me.id }));

  refreshClasses();
  redirect("/admin/classes");
}

/** Every picture a class uses: its summary's and its homework's. */
async function classPictures(classId: number): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("classes")
    .select("summary_images, homework(images)")
    .eq("id", classId)
    .maybeSingle<{ summary_images: string[]; homework: Array<{ images: string[] }> }>();
  return [...(data?.summary_images ?? []), ...(data?.homework ?? []).flatMap((h) => h.images)];
}

export async function setClassStatus(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = Number(field(fd, "id"));
  const status = field(fd, "status") === "published" ? "published" : "draft";
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").update({ status }).eq("id", id).select("id");
  if (error) redirect(withError("/admin/classes", "save_failed"));
  if (!data?.length) redirect(withError("/admin/classes", "gone"));
  if (status === "published") after(() => notifyNewClass(id, { exclude: me.id }));
  refreshClasses();
}

export async function deleteClass(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(field(fd, "id"));
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("number").eq("id", id).maybeSingle();
  if (!cls) return { error: "That class no longer exists." };
  if (field(fd, "confirm").trim() !== String(cls.number)) return { error: `Type ${cls.number} to confirm.` };
  // The class's pictures, and those in its question thread (deleted with the class), go too.
  const admin = createAdminClient();
  const { data: thread } = await admin.from("threads").select("id, images").eq("class_id", id).eq("is_class_thread", true).maybeSingle<{ id: number; images: string[] }>();
  const { data: replies } = thread
    ? await admin.from("posts").select("images").eq("thread_id", thread.id).returns<Array<{ images: string[] }>>()
    : { data: [] as Array<{ images: string[] }> };
  const pictures = [...(await classPictures(id)), ...(thread?.images ?? []), ...(replies ?? []).flatMap((r) => r.images)];
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  await removeImages(pictures);
  refreshClasses();
  redirect("/admin/classes");
}

/** Admin → Classes: "Email members" for a published class whose email hasn't gone out yet. */
export async function emailClassMembers(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = Number(field(fd, "id"));
  const result = await notifyNewClass(id, { exclude: me.id });
  refreshClasses();
  if (result.status === "skipped" && result.reason === "no-key") redirect(withError("/admin/classes", "email_off"));
  if (result.status === "skipped" && result.reason === "not-published") redirect(withError("/admin/classes", "gone"));
  if (result.status === "failed") redirect(withError("/admin/classes", "email_failed"));
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
