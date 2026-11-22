import { describe, expect, it } from "vitest";
import { adminClient, createClassFixture, createMember } from "../helpers/members";

describe("triggers and seed", () => {
  it("new auth user gets a profile", async () => {
    const m = await createMember({ name: "Ayesha Khan" });
    const { data } = await adminClient().from("profiles").select("full_name, role, status").eq("id", m.id).single();
    expect(data).toEqual({ full_name: "Ayesha Khan", role: "student", status: "active" });
  });

  it("publishing a class creates exactly one class thread", async () => {
    const admin = await createMember({ role: "admin" });
    const cls = await createClassFixture({ status: "draft" });
    const db = admin.client;
    await db.from("classes").update({ status: "published" }).eq("id", cls.classId);
    await db.from("classes").update({ title: "Renamed" }).eq("id", cls.classId);
    await db.from("classes").update({ status: "draft" }).eq("id", cls.classId);
    await db.from("classes").update({ status: "published" }).eq("id", cls.classId);
    const { data } = await adminClient()
      .from("threads")
      .select("title, author_id, is_class_thread")
      .eq("class_id", cls.classId);
    expect(data).toEqual([{ title: `Questions about Class ${cls.number}`, author_id: admin.id, is_class_thread: true }]);
  });

  it("rate limit: the 11th post in 10 minutes is refused", async () => {
    const m = await createMember();
    const { data: thread } = await m.client.from("threads").insert({ title: "T", body_md: "B" }).select("id").single();
    for (let i = 0; i < 9; i++) {
      const { error } = await m.client.from("posts").insert({ thread_id: thread!.id, body_md: `reply ${i}` });
      expect(error).toBeNull();
    }
    const { error } = await m.client.from("posts").insert({ thread_id: thread!.id, body_md: "one too many" });
    expect(error?.message).toContain("RATE_LIMIT");
  });

  it("hand-in required when the homework expects one", async () => {
    const cls = await createClassFixture({ homework: [{ handin_expected: true }, { handin_expected: false }] });
    const m = await createMember();
    const [withHandin, withoutHandin] = cls.homeworkIds;
    const { error: missing } = await m.client.from("homework_status").insert({ user_id: m.id, homework_id: withHandin });
    expect(missing?.message).toContain("HANDIN_REQUIRED");
    const { error: ok } = await m.client
      .from("homework_status")
      .insert({ user_id: m.id, homework_id: withHandin, handin_url: "https://example.com" });
    expect(ok).toBeNull();
    const { error: plain } = await m.client.from("homework_status").insert({ user_id: m.id, homework_id: withoutHandin });
    expect(plain).toBeNull();
  });

  it("reply bumps the thread's last_activity_at", async () => {
    const a = await createMember();
    const b = await createMember();
    const { data: thread } = await a.client.from("threads").insert({ title: "T", body_md: "B" }).select("id").single();
    const { data: post } = await b.client
      .from("posts")
      .insert({ thread_id: thread!.id, body_md: "reply" })
      .select("created_at")
      .single();
    const { data: t } = await adminClient().from("threads").select("last_activity_at").eq("id", thread!.id).single();
    expect(new Date(t!.last_activity_at).getTime()).toBe(new Date(post!.created_at).getTime());
  });

  it("editing a post sets edited_at", async () => {
    const a = await createMember();
    const { data: thread } = await a.client.from("threads").insert({ title: "T", body_md: "B" }).select("id, edited_at").single();
    expect(thread!.edited_at).toBeNull();
    await a.client.from("threads").update({ body_md: "B2" }).eq("id", thread!.id);
    const { data: t } = await adminClient().from("threads").select("edited_at").eq("id", thread!.id).single();
    expect(t!.edited_at).not.toBeNull();
  });

  it("deleting a user keeps their posts as Former member", async () => {
    const cls = await createClassFixture({ homework: [{}] });
    const a = await createMember();
    const b = await createMember();
    const { data: thread } = await a.client.from("threads").insert({ title: "T", body_md: "B" }).select("id").single();
    const { data: post } = await a.client.from("posts").insert({ thread_id: thread!.id, body_md: "mine" }).select("id").single();
    await b.client.from("posts").insert({ thread_id: thread!.id, body_md: "B's reply" });
    await a.client.from("class_reviews").insert({ user_id: a.id, class_id: cls.classId });
    await a.client.from("homework_status").insert({ user_id: a.id, homework_id: cls.homeworkIds[0] });

    const admin = adminClient();
    const { error } = await admin.auth.admin.deleteUser(a.id);
    expect(error).toBeNull();

    const { data: t } = await admin.from("threads").select("author_id").eq("id", thread!.id).single();
    expect(t!.author_id).toBeNull();
    const { data: p } = await admin.from("posts").select("author_id").eq("id", post!.id).single();
    expect(p!.author_id).toBeNull();
    const { count: reviews } = await admin.from("class_reviews").select("*", { count: "exact", head: true }).eq("user_id", a.id);
    const { count: statuses } = await admin.from("homework_status").select("*", { count: "exact", head: true }).eq("user_id", a.id);
    expect(reviews).toBe(0);
    expect(statuses).toBe(0);
  });

  it("seed: Classes 1–6 published with materials and class threads", async () => {
    const admin = adminClient();
    const { data: classes } = await admin.from("classes").select("id, number, status").lte("number", 6).order("number");
    expect(classes?.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classes?.every((c) => c.status === "published")).toBe(true);
    const class5 = classes!.find((c) => c.number === 5)!;
    const { count: materials } = await admin.from("class_materials").select("*", { count: "exact", head: true }).eq("class_id", class5.id);
    expect(materials).toBe(2);
    const { count: threads } = await admin
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("is_class_thread", true)
      .in("class_id", classes!.map((c) => c.id));
    expect(threads).toBe(6);
    const { data: settings } = await admin.from("settings").select("join_code").single();
    expect(settings?.join_code).toBe("batch91-change-me");
  });
});

describe("deleting a class", () => {
  it("removes its class thread but keeps general threads linked to it", async () => {
    const cls = await createClassFixture({ status: "published" });
    const m = await createMember();
    const { data: linked } = await m.client
      .from("threads")
      .insert({ title: "About this class", body_md: "B", class_id: cls.classId })
      .select("id")
      .single();
    const admin = adminClient();
    const { error } = await admin.from("classes").delete().eq("id", cls.classId);
    expect(error).toBeNull();
    const { count: classThreads } = await admin
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("title", `Questions about Class ${cls.number}`);
    expect(classThreads).toBe(0);
    const { data: kept } = await admin.from("threads").select("id, class_id").eq("id", linked!.id).single();
    expect(kept).toEqual({ id: linked!.id, class_id: null });
  });
});
