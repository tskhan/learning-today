import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassEmail } from "@/lib/class-email";

/** Resend's batch endpoint takes up to 100 emails per call. Overridable for tests. */
const RESEND_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails/batch";
const FROM = process.env.NOTIFY_FROM ?? "Batch 91 Portal <no-reply@learning-today.com>";
const PER_CALL = 100;

export type NotifyResult =
  | { status: "sent"; count: number }
  | { status: "skipped"; reason: "no-key" | "already-sent" | "not-published" }
  | { status: "failed"; reason: string };

interface ClassRow {
  number: number;
  title: string;
  class_date: string;
  summary_md: string;
  homework: Array<{ id: number; title: string; deadline: string | null; position: number }>;
}

/** Emails of active members who want class emails (emails live in Supabase Auth, not in profiles). */
async function recipients(exclude?: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id").eq("status", "active").eq("email_new_classes", true);
  const wanted = new Set((profiles ?? []).map((p) => p.id as string));
  if (exclude) wanted.delete(exclude);
  const emails: string[] = [];
  for (let page = 1; wanted.size > 0; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (wanted.has(u.id) && u.email) emails.push(u.email);
    if (data.users.length < 1000) break;
  }
  return emails;
}

/**
 * Emails every member (who hasn't turned it off) that a class guide is up. Each class is announced
 * once: the class is "claimed" by setting notified_at first, so two saves can't both send. If the
 * first send fails, the claim is undone so an admin can try again from Admin → Classes.
 */
export async function notifyNewClass(classId: number, opts: { exclude?: string } = {}): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("notifyNewClass: RESEND_API_KEY is not set, so no class email was sent (see portal/SETUP.md)");
    return { status: "skipped", reason: "no-key" };
  }
  const admin = createAdminClient();
  const claimedAt = new Date().toISOString();
  const { data: cls } = await admin
    .from("classes")
    .update({ notified_at: claimedAt })
    .eq("id", classId)
    .eq("status", "published")
    .is("notified_at", null)
    .select("number, title, class_date, summary_md, homework(id, title, deadline, position)")
    .maybeSingle<ClassRow>();
  if (!cls) {
    const { data: row } = await admin.from("classes").select("status").eq("id", classId).maybeSingle();
    return { status: "skipped", reason: row?.status === "published" ? "already-sent" : "not-published" };
  }

  const release = () => admin.from("classes").update({ notified_at: null }).eq("id", classId).eq("notified_at", claimedAt);
  try {
    const to = await recipients(opts.exclude);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.learning-today.com";
    const email = buildClassEmail(
      {
        number: cls.number,
        title: cls.title,
        classDate: cls.class_date,
        summaryMd: cls.summary_md,
        homework: [...cls.homework].sort((a, b) => a.position - b.position || a.id - b.id),
      },
      siteUrl,
    );
    for (let i = 0; i < to.length; i += PER_CALL) {
      // One email per member (no shared To/CC list, so nobody sees anyone else's address).
      const batch = to.slice(i, i + PER_CALL).map((address) => ({
        from: FROM,
        to: [address],
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: { "List-Unsubscribe": `<${siteUrl}/profile#emails>` },
      }));
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `class-${classId}-${claimedAt}-${i}`,
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const detail = `${res.status} ${(await res.text()).slice(0, 300)}`;
        console.error("notifyNewClass: Resend refused the emails", { classId, detail });
        // Nothing went out yet: undo the claim so it can be retried. (Later batches: keep it, to never double-send.)
        if (i === 0) await release();
        return { status: "failed", reason: detail };
      }
    }
    return { status: "sent", count: to.length };
  } catch (e) {
    console.error("notifyNewClass failed", e);
    await release();
    return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}
