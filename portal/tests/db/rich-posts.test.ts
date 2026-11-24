import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createClassFixture, createMember } from "../helpers/members";

// A 1×1 PNG.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const png = () => new Blob([PNG], { type: "image/png" });
const pathFor = (userId: string) => `${userId}/${randomUUID()}.png`;

async function newThread(client: ReturnType<typeof anonClient>, title = "Pictures") {
  const { data, error } = await client.from("threads").insert({ title, body_md: "Body" }).select("id").single();
  if (error) throw error;
  return data.id as number;
}

describe("rich posts (24 Nov 2026)", () => {
  it("a member can attach up to 4 of their own pictures, and nothing else", async () => {
    const m = await createMember();
    const other = await createMember();
    const thread = await newThread(m.client);
    const four = [pathFor(m.id), pathFor(m.id), pathFor(m.id), pathFor(m.id)];

    const { error: ok } = await m.client.from("posts").insert({ thread_id: thread, body_md: "Four", images: four });
    expect(ok).toBeNull();
    const { error: five } = await m.client.from("posts").insert({ thread_id: thread, body_md: "Five", images: [...four, pathFor(m.id)] });
    expect(five?.message).toMatch(/posts_images_valid/);
    const { error: notMine } = await m.client.from("posts").insert({ thread_id: thread, body_md: "Theirs", images: [pathFor(other.id)] });
    expect(notMine?.message).toMatch(/posts_images_valid/);
    const { error: badPath } = await m.client.from("posts").insert({ thread_id: thread, body_md: "Bad", images: [`${m.id}/../x.png`] });
    expect(badPath?.message).toMatch(/posts_images_valid/);
    const { error: onThread } = await m.client.from("threads").insert({ title: "With picture", body_md: "B", images: [pathFor(m.id)] });
    expect(onThread).toBeNull();
  });

  it("a reply can quote a reply in the same discussion only, and loses the quote if it's deleted", async () => {
    const m = await createMember();
    const t1 = await newThread(m.client, "One");
    const t2 = await newThread(m.client, "Two");
    const { data: first } = await m.client.from("posts").insert({ thread_id: t1, body_md: "First" }).select("id").single();
    const { data: quoting, error } = await m.client.from("posts").insert({ thread_id: t1, body_md: "Quoting", reply_to: first!.id }).select("id").single();
    expect(error).toBeNull();
    const { error: crossThread } = await m.client.from("posts").insert({ thread_id: t2, body_md: "Elsewhere", reply_to: first!.id });
    expect(crossThread).not.toBeNull();

    await m.client.from("posts").delete().eq("id", first!.id);
    const { data } = await adminClient().from("posts").select("reply_to").eq("id", quoting!.id).single();
    expect(data?.reply_to).toBeNull();
  });

  it("members upload only into their own folder; visitors and removed members can't", async () => {
    const m = await createMember();
    const other = await createMember();
    const bucket = m.client.storage.from("post-images");

    const mine = pathFor(m.id);
    expect((await bucket.upload(mine, png(), { contentType: "image/png" })).error).toBeNull();
    expect((await bucket.upload(pathFor(other.id), png(), { contentType: "image/png" })).error).not.toBeNull();
    expect((await anonClient().storage.from("post-images").upload(pathFor(m.id), png(), { contentType: "image/png" })).error).not.toBeNull();

    // only pictures are accepted
    const { error: notImage } = await bucket.upload(`${m.id}/${randomUUID()}.png`, new Blob(["hello"], { type: "text/plain" }), { contentType: "text/plain" });
    expect(notImage).not.toBeNull();

    const removed = await createMember({ status: "removed" });
    expect((await removed.client.storage.from("post-images").upload(pathFor(removed.id), png(), { contentType: "image/png" })).error).not.toBeNull();
  });

  it("members read only their own picture files (others' come as signed links); admins read all", async () => {
    const m = await createMember();
    const path = pathFor(m.id);
    await m.client.storage.from("post-images").upload(path, png(), { contentType: "image/png" });
    expect((await m.client.storage.from("post-images").download(path)).error).toBeNull();

    const classmate = await createMember();
    expect((await classmate.client.storage.from("post-images").download(path)).error).not.toBeNull();
    const { data: listed } = await classmate.client.storage.from("post-images").list(m.id);
    expect(listed ?? []).toEqual([]);
    const admin = await createMember({ role: "admin" });
    expect((await admin.client.storage.from("post-images").download(path)).error).toBeNull();
    // what the portal shows: a signed link made on the server
    const { data: signed } = await adminClient().storage.from("post-images").createSignedUrl(path, 60);
    expect((await fetch(signed!.signedUrl)).status).toBe(200);
    expect((await anonClient().storage.from("post-images").download(path)).error).not.toBeNull();
    const removed = await createMember({ status: "removed" });
    expect((await removed.client.storage.from("post-images").download(path)).error).not.toBeNull();
  });

  it("only the uploader or an admin can delete a picture", async () => {
    const m = await createMember();
    const path = pathFor(m.id);
    await m.client.storage.from("post-images").upload(path, png(), { contentType: "image/png" });
    const exists = async () => (await adminClient().storage.from("post-images").download(path)).error === null;

    const classmate = await createMember();
    await classmate.client.storage.from("post-images").remove([path]);
    expect(await exists()).toBe(true);

    const removed = await createMember();
    const theirs = pathFor(removed.id);
    await removed.client.storage.from("post-images").upload(theirs, png(), { contentType: "image/png" });
    await adminClient().from("profiles").update({ status: "removed" }).eq("id", removed.id);
    await removed.client.storage.from("post-images").remove([theirs]);
    expect((await adminClient().storage.from("post-images").download(theirs)).error).toBeNull();

    const admin = await createMember({ role: "admin" });
    await admin.client.storage.from("post-images").remove([path]);
    expect(await exists()).toBe(false);
  });

  it("unused_images lists pictures nothing uses, for the server only", async () => {
    const m = await createMember();
    const used = pathFor(m.id);
    const unused = pathFor(m.id);
    for (const p of [used, unused]) await m.client.storage.from("post-images").upload(p, png(), { contentType: "image/png" });
    await m.client.from("threads").insert({ title: "Uses a picture", body_md: "B", images: [used] });

    const { data, error } = await adminClient().rpc("unused_images", { p_older_than: "0 seconds", p_limit: 100000 });
    expect(error).toBeNull();
    expect(data).toContain(unused);
    expect(data).not.toContain(used);
    const { data: recent } = await adminClient().rpc("unused_images", { p_limit: 100000 });
    expect(recent).not.toContain(unused); // under two days old: left alone

    expect((await m.client.rpc("unused_images")).error).not.toBeNull();
    expect((await anonClient().rpc("unused_images")).error).not.toBeNull();
  });

  it("save_class_with_images saves the class's and each homework's pictures, all-or-nothing", async () => {
    const admin = await createMember({ role: "admin" });
    const number = 6000 + Math.floor(Math.random() * 1000);
    const summaryPic = pathFor(admin.id);
    const hwPic = pathFor(admin.id);
    const args = {
      p_id: null, p_number: number, p_class_date: "2026-11-29", p_title: "Pictured", p_summary_md: "S",
      p_summary_images: [summaryPic], p_status: "draft", p_materials: [],
      p_homework: [{ id: null, title: "HW", instructions_md: "", images: [hwPic], deadline: null, handin_expected: false, position: 0 }],
    };
    const { data: id, error } = await admin.client.rpc("save_class_with_images", args);
    expect(error).toBeNull();
    const { data: cls } = await adminClient().from("classes").select("summary_images, homework(images)").eq("id", id).single();
    expect(cls?.summary_images).toEqual([summaryPic]);
    expect(cls?.homework).toEqual([{ images: [hwPic] }]);

    const { error: bad } = await admin.client.rpc("save_class_with_images", { ...args, p_id: id, p_title: "Changed", p_summary_images: ["not-a-path"] });
    expect(bad).not.toBeNull();
    const { data: after } = await adminClient().from("classes").select("title").eq("id", id).single();
    expect(after?.title).toBe("Pictured");

    const student = await createMember();
    const { error: denied } = await student.client.rpc("save_class_with_images", { ...args, p_number: number + 1 });
    expect(denied?.message).toMatch(/NOT_ADMIN|permission denied/);
  });

  it("the current app's save_class() still works", async () => {
    const admin = await createMember({ role: "admin" });
    const cls = await createClassFixture({ title: "Old path" });
    const { error } = await admin.client.rpc("save_class", {
      p_id: cls.classId, p_number: cls.number, p_class_date: "2026-11-29", p_title: "Old path still saves",
      p_summary_md: "S", p_status: "published", p_materials: [], p_homework: [],
    });
    expect(error).toBeNull();
  });
});
