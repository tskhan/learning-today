import { describe, expect, it } from "vitest";
import { adminClient, createClassFixture, createMember } from "../helpers/members";

const saveArgs = (over: Record<string, unknown>) => ({
  p_id: null,
  p_number: 0,
  p_class_date: "2026-11-29",
  p_title: "Saved class",
  p_summary_md: "Summary",
  p_status: "draft",
  p_materials: [],
  p_homework: [],
  ...over,
});

describe("portal improvements (24 Nov 2026)", () => {
  it("save_class writes the class, materials and homework in one go, keeping hand-ins on edit", async () => {
    const admin = await createMember({ role: "admin" });
    const student = await createMember();
    const number = 3000 + Math.floor(Math.random() * 1000);
    const { data: id, error } = await admin.client.rpc("save_class", saveArgs({
      p_number: number,
      p_status: "published",
      p_materials: [{ label: "Slides", url: "https://example.com/s", position: 0 }],
      p_homework: [{ id: null, title: "Task", instructions_md: "", deadline: null, handin_expected: false, position: 0 }],
    }));
    expect(error).toBeNull();
    const { data: hw } = await adminClient().from("homework").select("id").eq("class_id", id);
    expect(hw).toHaveLength(1);
    await student.client.from("homework_status").insert({ user_id: student.id, homework_id: hw![0].id });

    // edit: rename the homework, add a second one; the first keeps its hand-in
    const { error: editError } = await admin.client.rpc("save_class", saveArgs({
      p_id: id, p_number: number, p_status: "published",
      p_materials: [{ label: "Slides v2", url: "https://example.com/s2", position: 0 }],
      p_homework: [
        { id: hw![0].id, title: "Task renamed", instructions_md: "", deadline: null, handin_expected: false, position: 0 },
        { id: null, title: "Second", instructions_md: "", deadline: "2026-12-06T18:59:00.000Z", handin_expected: true, position: 1 },
      ],
    }));
    expect(editError).toBeNull();
    const { data: after } = await adminClient().from("homework").select("title").eq("class_id", id).order("position");
    expect(after?.map((h) => h.title)).toEqual(["Task renamed", "Second"]);
    const { count } = await adminClient().from("homework_status").select("user_id", { count: "exact", head: true }).eq("homework_id", hw![0].id);
    expect(count).toBe(1);
    const { data: mats } = await adminClient().from("class_materials").select("label").eq("class_id", id);
    expect(mats).toEqual([{ label: "Slides v2" }]);
  });

  it("a failure part-way through save_class leaves the class exactly as it was", async () => {
    const admin = await createMember({ role: "admin" });
    const cls = await createClassFixture({ title: "Before", homework: [{ title: "Old homework" }] });
    const { error } = await admin.client.rpc("save_class", saveArgs({
      p_id: cls.classId, p_number: cls.number, p_title: "After", p_status: "published",
      // a link the database refuses (not http/https), after the class row has been updated
      p_materials: [{ label: "Bad", url: "javascript:alert(1)", position: 0 }],
      p_homework: [],
    }));
    expect(error).not.toBeNull();
    const { data: row } = await adminClient().from("classes").select("title").eq("id", cls.classId).single();
    expect(row?.title).toBe("Before");
    const { data: hw } = await adminClient().from("homework").select("title").eq("class_id", cls.classId);
    expect(hw).toEqual([{ title: "Old homework" }]);
  });

  it("students can't call save_class", async () => {
    const student = await createMember();
    const { error } = await student.client.rpc("save_class", saveArgs({ p_number: 4999 }));
    expect(error?.message).toMatch(/NOT_ADMIN|permission denied/);
    const { data } = await adminClient().from("classes").select("id").eq("number", 4999);
    expect(data).toEqual([]);
  });

  it("a class's question thread is hidden from students while the class is a draft, and can't be replied to", async () => {
    const cls = await createClassFixture({ status: "published" });
    const { data: thread } = await adminClient().from("threads").select("id").eq("class_id", cls.classId).eq("is_class_thread", true).single();
    await adminClient().from("posts").insert({ thread_id: thread!.id, body_md: "An early reply" });
    await adminClient().from("classes").update({ status: "draft" }).eq("id", cls.classId);

    const student = await createMember();
    const admin = await createMember({ role: "admin" });
    const { data: seen } = await student.client.from("threads").select("id").eq("id", thread!.id);
    expect(seen).toEqual([]);
    const { data: posts } = await student.client.from("posts").select("id").eq("thread_id", thread!.id);
    expect(posts).toEqual([]);
    const { error: replyError } = await student.client.from("posts").insert({ thread_id: thread!.id, body_md: "Can I?" });
    expect(replyError).not.toBeNull();
    const { data: adminSees } = await admin.client.from("threads").select("id").eq("id", thread!.id);
    expect(adminSees).toHaveLength(1);

    await adminClient().from("classes").update({ status: "published" }).eq("id", cls.classId);
    const { data: back } = await student.client.from("threads").select("id").eq("id", thread!.id);
    expect(back).toHaveLength(1);
  });

  it("general threads that mention a draft class stay visible", async () => {
    const cls = await createClassFixture({ status: "draft" });
    const author = await createMember();
    const { data: t, error } = await author.client.from("threads").insert({ title: "About a draft", body_md: "Hi", class_id: cls.classId }).select("id").single();
    expect(error).toBeNull();
    const other = await createMember();
    const { data } = await other.client.from("threads").select("id").eq("id", t!.id);
    expect(data).toHaveLength(1);
  });

  it("renumbering or renaming a class renames its question thread, without an 'edited' mark", async () => {
    const cls = await createClassFixture({ title: "Old title" });
    const newNumber = cls.number + 50000;
    await adminClient().from("classes").update({ number: newNumber, title: "New title" }).eq("id", cls.classId);
    const { data: thread } = await adminClient()
      .from("threads").select("title, body_md, edited_at").eq("class_id", cls.classId).eq("is_class_thread", true).single();
    expect(thread?.title).toBe(`Questions about Class ${newNumber}`);
    expect(thread?.body_md).toBe(`Ask anything about Class ${newNumber}: New title. Classmates and admins will reply here.`);
    expect(thread?.edited_at).toBeNull();
  });

  it("a member's own edit is still marked as edited", async () => {
    const m = await createMember();
    const { data: t } = await m.client.from("threads").insert({ title: "Mine", body_md: "First" }).select("id").single();
    await m.client.from("threads").update({ body_md: "Second" }).eq("id", t!.id);
    const { data } = await adminClient().from("threads").select("edited_at").eq("id", t!.id).single();
    expect(data?.edited_at).not.toBeNull();
  });
});
