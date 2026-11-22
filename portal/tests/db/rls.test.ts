import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createClassFixture, createMember } from "../helpers/members";

describe("row-level security", () => {
  it("anon sees nothing", async () => {
    const anon = anonClient();
    for (const table of ["classes", "profiles", "threads"]) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? []).toEqual([]);
    }
  });

  it("student sees published classes only; admin sees drafts too", async () => {
    const draft = await createClassFixture({ status: "draft" });
    const published = await createClassFixture({ status: "published" });
    const student = await createMember();
    const admin = await createMember({ role: "admin" });

    const { data: seen } = await student.client.from("classes").select("id").in("id", [draft.classId, published.classId]);
    expect(seen?.map((r) => r.id)).toEqual([published.classId]);

    const { data: adminSeen } = await admin.client.from("classes").select("id").in("id", [draft.classId, published.classId]);
    expect(adminSeen?.map((r) => r.id).sort()).toEqual([draft.classId, published.classId].sort());
  });

  it("student cannot write classes", async () => {
    const student = await createMember();
    const { error } = await student.client
      .from("classes")
      .insert({ number: 99999, class_date: "2026-12-01", title: "Hack" });
    expect(error).not.toBeNull();
  });

  it("student cannot read settings", async () => {
    const student = await createMember();
    const { data, error } = await student.client.from("settings").select("*");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("student cannot change own role, status or a thread's pinned flag", async () => {
    const student = await createMember();
    const { error: roleError } = await student.client.from("profiles").update({ role: "admin" }).eq("id", student.id);
    expect(roleError).not.toBeNull();
    const { error: statusError } = await student.client.from("profiles").update({ status: "removed" }).eq("id", student.id);
    expect(statusError).not.toBeNull();

    const { data: thread, error: te } = await student.client
      .from("threads")
      .insert({ title: "Mine", body_md: "Body" })
      .select("id")
      .single();
    expect(te).toBeNull();
    const { error: pinError } = await student.client.from("threads").update({ pinned: true }).eq("id", thread!.id);
    expect(pinError).not.toBeNull();

    const { data: check } = await adminClient().from("profiles").select("role, status").eq("id", student.id).single();
    expect(check).toEqual({ role: "student", status: "active" });
  });

  it("student can change own name only", async () => {
    const a = await createMember();
    const b = await createMember();
    await a.client.from("profiles").update({ full_name: "New Name" }).eq("id", a.id);
    await a.client.from("profiles").update({ full_name: "Hijacked" }).eq("id", b.id);
    const { data } = await adminClient().from("profiles").select("id, full_name").in("id", [a.id, b.id]);
    const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r.full_name]));
    expect(byId[a.id]).toBe("New Name");
    expect(byId[b.id]).toBe(b.name);
  });

  it("student cannot review on behalf of someone else", async () => {
    const cls = await createClassFixture();
    const a = await createMember();
    const b = await createMember();
    const { error } = await a.client.from("class_reviews").insert({ user_id: b.id, class_id: cls.classId });
    expect(error).not.toBeNull();
    const { error: own } = await a.client.from("class_reviews").insert({ user_id: a.id, class_id: cls.classId });
    expect(own).toBeNull();
  });

  it("classmates can read hand-ins", async () => {
    const cls = await createClassFixture({ homework: [{ handin_expected: true }] });
    const a = await createMember();
    const b = await createMember();
    const { error } = await a.client
      .from("homework_status")
      .insert({ user_id: a.id, homework_id: cls.homeworkIds[0], handin_url: "https://a.example.com" });
    expect(error).toBeNull();
    const { data } = await b.client.from("homework_status").select("user_id, handin_url").eq("homework_id", cls.homeworkIds[0]);
    expect(data).toEqual([{ user_id: a.id, handin_url: "https://a.example.com" }]);
  });

  it("removed member sees nothing and cannot post", async () => {
    await createClassFixture();
    const m = await createMember();
    const { data: before } = await m.client.from("classes").select("id").limit(1);
    expect((before ?? []).length).toBe(1);

    await adminClient().from("profiles").update({ status: "removed" }).eq("id", m.id);

    for (const table of ["classes", "threads", "profiles"]) {
      const { data } = await m.client.from(table).select("*").limit(5);
      expect(data ?? []).toEqual([]);
    }
    const { error } = await m.client.from("threads").insert({ title: "Still here?", body_md: "Hi" });
    expect(error).not.toBeNull();
  });

  it("javascript: URLs are rejected for hand-ins and materials", async () => {
    const cls = await createClassFixture({ homework: [{ handin_expected: true }] });
    const m = await createMember();
    const { error } = await m.client
      .from("homework_status")
      .insert({ user_id: m.id, homework_id: cls.homeworkIds[0], handin_url: "javascript:alert(1)" });
    expect(error).not.toBeNull();
    const { error: matError } = await adminClient()
      .from("class_materials")
      .insert({ class_id: cls.classId, label: "Bad", url: "javascript:alert(1)" });
    expect(matError).not.toBeNull();
  });
});
