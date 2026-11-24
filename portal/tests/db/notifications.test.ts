import { describe, expect, it } from "vitest";
import { adminClient, createClassFixture, createMember } from "../helpers/members";

describe("new-class notifications (24 Nov 2026)", () => {
  it("published_at is set when a class is first published, and kept after that", async () => {
    const cls = await createClassFixture({ status: "draft" });
    const admin = adminClient();
    const read = async () => (await admin.from("classes").select("published_at").eq("id", cls.classId).single()).data?.published_at as string | null;
    expect(await read()).toBeNull();

    await admin.from("classes").update({ status: "published" }).eq("id", cls.classId);
    const first = await read();
    expect(first).not.toBeNull();

    await admin.from("classes").update({ status: "draft" }).eq("id", cls.classId);
    await admin.from("classes").update({ status: "published" }).eq("id", cls.classId);
    expect(await read()).toBe(first);
  });

  it("a class created as published gets published_at straight away, but isn't marked as emailed", async () => {
    const cls = await createClassFixture({ status: "published" });
    const { data } = await adminClient().from("classes").select("published_at, notified_at").eq("id", cls.classId).single();
    expect(data?.published_at).not.toBeNull();
    expect(data?.notified_at).toBeNull();
  });

  it("classes published before this change count as already announced, and not as new", async () => {
    const { data } = await adminClient().from("classes").select("number, notified_at, published_at").in("number", [1, 2, 3, 4, 5, 6]);
    expect(data?.length).toBe(6);
    for (const c of data ?? []) {
      expect(c.notified_at).not.toBeNull();
      expect(c.published_at).toBeNull();
    }
  });

  it("members can turn class emails off for themselves only", async () => {
    const m = await createMember();
    const other = await createMember();
    const read = async (id: string) => (await adminClient().from("profiles").select("email_new_classes").eq("id", id).single()).data?.email_new_classes;
    expect(await read(m.id)).toBe(true);

    await m.client.from("profiles").update({ email_new_classes: false }).eq("id", m.id);
    expect(await read(m.id)).toBe(false);

    await m.client.from("profiles").update({ email_new_classes: false }).eq("id", other.id);
    expect(await read(other.id)).toBe(true);
  });
});
