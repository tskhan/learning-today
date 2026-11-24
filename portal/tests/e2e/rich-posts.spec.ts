import { expect, test, type Page } from "@playwright/test";
import { adminClient, clearFixtureClasses, createClassFixture, createMember, loginAs } from "../helpers/members";
import { makePng } from "../helpers/png";

const picture = (name = "photo.png", rgb: [number, number, number] = [196, 95, 0]) => ({ name, mimeType: "image/png", buffer: makePng(320, 200, rgb) });

async function newDiscussion(page: Page, title: string) {
  await page.goto("/discussions/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message", { exact: true }).fill("Opening message");
  await page.getByRole("button", { name: "Post discussion" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return Number(new URL(page.url()).pathname.split("/").pop());
}

async function stored(table: "posts" | "threads", id: number) {
  const { data } = await adminClient().from(table).select("body_md, images, reply_to, quoted").eq("id", id).single();
  return data as { body_md: string; images: string[]; reply_to: number | null; quoted: boolean };
}

async function fileExists(path: string) {
  return (await adminClient().storage.from("post-images").download(path)).error === null;
}

test("formatting with the toolbar is saved and shown: bold, italic, underline", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  const id = await newDiscussion(page, `Formatting ${Date.now()}`);
  const box = page.getByLabel("Your reply");
  await box.click();
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("strong");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type(" and ");
  await page.getByRole("button", { name: "Italic" }).click();
  await page.keyboard.type("slanted");
  await page.getByRole("button", { name: "Italic" }).click();
  await page.keyboard.type(" and ");
  await page.getByRole("button", { name: "Underline" }).click();
  await page.keyboard.type("lined");
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  const reply = page.locator("article.post").nth(1);
  await expect(reply.locator("strong", { hasText: "strong" })).toBeVisible();
  await expect(reply.locator("em", { hasText: "slanted" })).toBeVisible();
  await expect(reply.locator("u", { hasText: "lined" })).toBeVisible();
  const { data } = await adminClient().from("posts").select("body_md").eq("thread_id", id).single();
  expect(data?.body_md).toBe("**strong** and *slanted* and <u>lined</u>");
});

test("a picture can be added to a reply, is shown in it, and can be the whole reply", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  await newDiscussion(page, `Pictures ${Date.now()}`);
  await page.locator("#reply-form input[type=file]").setInputFiles(picture());
  await expect(page.getByRole("img", { name: "Picture 1" })).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  const reply = page.locator("article.post").nth(1);
  await expect(reply.locator(".post-images img")).toHaveCount(1);
  const postId = Number((await reply.getAttribute("id"))!.replace("post-", ""));
  const saved = await stored("posts", postId);
  expect(saved.body_md).toBe("");
  expect(saved.images).toHaveLength(1);
  expect(saved.images[0]).toMatch(new RegExp(`^${m.id}/[0-9a-f-]{36}\\.(webp|jpg)$`));
  expect(await fileExists(saved.images[0])).toBe(true);

  // a classmate sees it too
  const classmate = await createMember();
  await page.context().clearCookies();
  await loginAs(page, classmate, new URL(page.url()).pathname);
  await expect(page.locator("article.post").nth(1).locator(".post-images img")).toBeVisible();
});

test("at most four pictures; removing one before sending deletes its file", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  await newDiscussion(page, `Four ${Date.now()}`);
  const add = page.locator("#reply-form input[type=file]");
  await add.setInputFiles([picture("a.png"), picture("b.png", [0, 120, 80]), picture("c.png", [30, 60, 160]), picture("d.png"), picture("e.png")]);
  await expect(page.getByText("Only 4 pictures fit, so 1 was left out.")).toBeVisible();
  await expect(page.locator(".attachments img")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "📎 Add pictures" })).toBeDisabled();

  const src = await page.locator(".attachments img").first().getAttribute("src");
  const path = decodeURIComponent(new URL(src!).pathname.split("/post-images/")[1]);
  expect(await fileExists(path)).toBe(true);
  await page.getByRole("button", { name: "Remove picture 1" }).click();
  await expect(page.locator(".attachments img")).toHaveCount(3);
  await expect.poll(() => fileExists(path)).toBe(false);
});

test("replying to a particular reply quotes it and links back; deleting the original says so", async ({ page }) => {
  const m = await createMember({ name: "Quoted Person" });
  await loginAs(page, m);
  await newDiscussion(page, `Quotes ${Date.now()}`);
  await page.getByLabel("Your reply").fill("The original point");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.locator("article.post").nth(1)).toContainText("The original point");

  await page.getByRole("link", { name: "Reply to Quoted Person" }).click();
  await expect(page.locator(".replying-to")).toContainText("Replying to Quoted Person: The original point");
  await page.getByLabel("Your reply").fill("Answering that");
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  const answer = page.locator("article.post").nth(2);
  const quote = answer.locator("a.quote");
  await expect(quote).toContainText("Quoted Person");
  await expect(quote).toContainText("The original point");
  await expect(page.locator(".replying-to")).toHaveCount(0);
  const originalId = (await page.locator("article.post").nth(1).getAttribute("id"))!;
  await expect(quote).toHaveAttribute("href", `#${originalId}`);

  // delete the original: the quote says it was deleted
  page.once("dialog", (d) => d.accept());
  await page.locator("article.post").nth(1).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Original message was deleted")).toBeVisible();
});

test("deleting a reply deletes its pictures; editing can remove a picture", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  await newDiscussion(page, `Cleanup ${Date.now()}`);
  await page.getByLabel("Your reply").fill("Two pictures");
  await page.locator("#reply-form input[type=file]").setInputFiles([picture("a.png"), picture("b.png", [0, 120, 80])]);
  await expect(page.locator(".attachments img")).toHaveCount(2);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const reply = page.locator("article.post").nth(1);
  await expect(reply.locator(".post-images img")).toHaveCount(2);
  const postId = Number((await reply.getAttribute("id"))!.replace("post-", ""));
  const [first, second] = (await stored("posts", postId)).images;

  await reply.getByRole("link", { name: "Edit" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Remove picture 1" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(`#post-${postId} .post-images img`)).toHaveCount(1);
  expect((await stored("posts", postId)).images).toEqual([second]);
  await expect.poll(() => fileExists(first)).toBe(false);

  page.once("dialog", (d) => d.accept());
  await page.locator(`#post-${postId}`).getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(`#post-${postId}`)).toHaveCount(0);
  await expect.poll(() => fileExists(second)).toBe(false);
});

test("class guides: the summary and homework take formatting and pictures", async ({ page }) => {
  await clearFixtureClasses();
  const admin = await createMember({ role: "admin" });
  const cls = await createClassFixture({ title: "Guide with pictures", homework: [{ title: "Pictured homework" }] });
  await loginAs(page, admin, `/admin/classes/${cls.classId}`);
  await page.waitForLoadState("networkidle");

  const summary = page.getByLabel("What was discussed");
  await summary.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Heading" }).first().click();
  await page.keyboard.type("New topic");
  await page.locator("#summary_md-files").setInputFiles(picture("summary.png"));
  await page.locator("[id^=hi-][id$=-files]").setInputFiles(picture("hw.png", [0, 120, 80]));
  await expect(page.locator(".attachments img")).toHaveCount(2);
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page).toHaveURL("/admin/classes");

  const { data } = await adminClient().from("classes").select("summary_md, summary_images, homework(images)").eq("id", cls.classId).single();
  expect(data?.summary_md).toContain("## New topic");
  expect(data?.summary_images).toHaveLength(1);
  expect(data?.homework?.[0]?.images).toHaveLength(1);

  await page.goto(`/classes/${cls.number}`);
  await expect(page.getByRole("heading", { name: "New topic" })).toBeVisible();
  await expect(page.locator(".post-images img")).toHaveCount(2);
});

test("pasting a picture (Ctrl+V) into the message box attaches it", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  await newDiscussion(page, `Paste ${Date.now()}`);
  const box = page.getByLabel("Your reply");
  await box.click();
  const png = makePng(240, 160, [0, 120, 80]).toString("base64");
  await box.evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "screenshot.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, png);
  await expect(page.locator(".attachments img")).toHaveCount(1);
  await expect(box).toHaveText("");
});
