import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createClassFixture, createMember } from "../helpers/members";

describe("security hardening (23 Nov 2026 audit)", () => {
  it("an account not created by the join form starts removed and sees nothing", async () => {
    await createClassFixture();
    const admin = adminClient();
    const email = `bypass${Date.now()}@test.dev`;
    const password = "password-123";
    // Created directly, without the join form activating it: what Supabase's own sign-up would create.
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Bypass" } });
    expect(error).toBeNull();
    const { data: profile } = await admin.from("profiles").select("status").eq("id", data.user!.id).single();
    expect(profile?.status).toBe("removed");

    const client = anonClient();
    await client.auth.signInWithPassword({ email, password });
    const { data: classes } = await client.from("classes").select("id").limit(5);
    expect(classes ?? []).toEqual([]);
    const { error: postError } = await client.from("threads").insert({ title: "Sneaky", body_md: "Hi" });
    expect(postError).not.toBeNull();
  });

  it("a new removed account can't make itself active", async () => {
    const admin = adminClient();
    const email = `self${Date.now()}@test.dev`;
    const { data } = await admin.auth.admin.createUser({ email, password: "password-123", email_confirm: true });
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: "password-123" });
    await client.from("profiles").update({ status: "active" }).eq("id", data.user!.id);
    const { data: profile } = await admin.from("profiles").select("status").eq("id", data.user!.id).single();
    expect(profile?.status).toBe("removed");
  });

  it("hand-in notes are private: classmates see the link but not the note", async () => {
    const cls = await createClassFixture({ homework: [{ handin_expected: true }] });
    const a = await createMember();
    const b = await createMember();
    const { error } = await a.client
      .from("homework_status")
      .insert({ user_id: a.id, homework_id: cls.homeworkIds[0], handin_url: "https://a.example.com", note: "private thought" });
    expect(error).toBeNull();
    // the author can still change their own note (the update path the app uses)
    const { data: updated, error: again } = await a.client
      .from("homework_status")
      .update({ note: "edited thought" })
      .eq("user_id", a.id)
      .eq("homework_id", cls.homeworkIds[0])
      .select("homework_id");
    expect(again).toBeNull();
    expect(updated).toHaveLength(1);

    const { error: readNote } = await b.client.from("homework_status").select("note").eq("homework_id", cls.homeworkIds[0]);
    expect(readNote?.message).toMatch(/permission denied/);
    const { data: link } = await b.client.from("homework_status").select("user_id, handin_url").eq("homework_id", cls.homeworkIds[0]);
    expect(link).toEqual([{ user_id: a.id, handin_url: "https://a.example.com" }]);

    const { data: stored } = await adminClient().from("homework_status").select("note").eq("user_id", a.id).single();
    expect(stored?.note).toBe("edited thought");
  });

  it("members and visitors can't touch the join code attempt log", async () => {
    const m = await createMember();
    for (const client of [m.client, anonClient()]) {
      const { error: readError } = await client.from("signup_attempts").select("id").limit(1);
      expect(readError?.message).toMatch(/permission denied/);
      const { error: writeError } = await client.from("signup_attempts").insert({ ip: "1.2.3.4" });
      expect(writeError).not.toBeNull();
    }
  });
});
