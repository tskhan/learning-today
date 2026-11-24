import { expect, test } from "@playwright/test";
import { adminClient, createMember, loginAs } from "../helpers/members";
import { makePng } from "../helpers/png";

test.beforeEach(async ({ page }) => {
  // The browser's own pop-ups ("JavaScript from … says") must never appear.
  page.on("dialog", (d) => {
    throw new Error(`Unexpected browser pop-up: ${d.message()}`);
  });
});

test("Delete asks in the portal's own dialog; Cancel keeps the reply", async ({ page }) => {
  const m = await createMember();
  const { data: t } = await m.client.from("threads").insert({ title: "Confirm", body_md: "B" }).select("id").single();
  await m.client.from("posts").insert({ thread_id: t!.id, body_md: "Keep me unless I'm sure" });
  await loginAs(page, m, `/discussions/${t!.id}`);
  await page.waitForLoadState("networkidle");

  const reply = page.locator("article.post").nth(1);
  await reply.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this reply?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("This can't be undone.");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Keep me unless I'm sure")).toBeVisible();

  await reply.getByRole("button", { name: "Delete" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Keep me unless I'm sure")).toBeVisible();

  await reply.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Keep me unless I'm sure")).toHaveCount(0);
});

test("pictures open large in the page: magnifier on hover, arrows, Esc and click outside close", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/discussions/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(`Viewer ${Date.now()}`);
  await page.getByLabel("Message", { exact: true }).fill("Two screenshots");
  await page.locator("input[type=file]").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: makePng(800, 500, [196, 95, 0]) },
    { name: "b.png", mimeType: "image/png", buffer: makePng(800, 500, [0, 120, 80]) },
  ]);
  await expect(page.locator(".attachments img")).toHaveCount(2);
  await page.getByRole("button", { name: "Post discussion" }).click();

  const first = page.getByRole("button", { name: "View picture 1 of 2 larger" });
  await expect(first).toBeVisible();
  await expect(first).toHaveCSS("cursor", "zoom-in");
  await first.hover();
  await expect(first.locator(".zoom")).toHaveCSS("opacity", "1");

  await first.click();
  const viewer = page.getByRole("dialog", { name: "Picture 1 of 2" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("img", { name: "Picture 1 of 2" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Picture 2 of 2" })).toBeVisible();
  await page.getByRole("button", { name: "Previous picture" }).click();
  await expect(page.getByRole("dialog", { name: "Picture 1 of 2" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // a click on the dark area around the picture closes it too
  await first.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(5, page.viewportSize()!.height - 5);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the Link button asks for the address in the portal's own box", async ({ page }) => {
  const m = await createMember();
  const { data: t } = await m.client.from("threads").insert({ title: "Links", body_md: "B" }).select("id").single();
  await loginAs(page, m, `/discussions/${t!.id}`);
  await page.waitForLoadState("networkidle");
  const box = page.getByLabel("Your reply");
  await box.fill("See the docs");
  await box.press("Shift+Home");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a link" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Link address").fill("example.com/docs");
  await dialog.getByLabel("Link address").press("Enter");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  await expect(page.locator('article.post .prose a[href="https://example.com/docs"]')).toHaveText("See the docs");
  const { data } = await adminClient().from("posts").select("body_md").eq("thread_id", t!.id).single();
  expect(data?.body_md).toBe("[See the docs](https://example.com/docs)");
});
