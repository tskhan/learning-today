import { expect, test } from "@playwright/test";
import { adminClient, createClassFixture, createMember, loginAs } from "../helpers/members";

test("seeded class guide shows summary, material and the class thread", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/classes/5");
  await expect(page.getByRole("heading", { name: "Chapter 1 and coding agents" })).toBeVisible();
  await expect(page.getByText("Claude Code and OpenCode setup.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Claude 2.0 Practical, Chapter 1: The New Way of Working" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Class slides: Claude Code and OpenCode setup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Questions about this class" })).toBeVisible();
  await expect(page.getByLabel("Your reply")).toBeVisible();
});

test("classes list shows every published class with its status", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/classes");
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await expect(page.locator(`a[href="/classes/${n}"]`).first()).toBeVisible();
  }
  await expect(page.getByText("Not reviewed").first()).toBeVisible();
});

test("draft classes are hidden from students", async ({ page }) => {
  const draft = await createClassFixture({ status: "draft" });
  const m = await createMember();
  await loginAs(page, m);
  const res = await page.goto(`/classes/${draft.number}`);
  expect(res?.status()).toBe(404);
});

test("mark reviewed twice is harmless", async ({ page }) => {
  const cls = await createClassFixture();
  const m = await createMember();
  await loginAs(page, m, `/classes/${cls.number}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "I've reviewed this class" }).click();
  await expect(page.getByRole("button", { name: "Undo review" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Undo review" }).click();
  const markButton = page.getByRole("button", { name: "I've reviewed this class" });
  await expect(markButton).toBeVisible();
  await markButton.dblclick();
  await expect(page.getByRole("button", { name: "Undo review" })).toBeVisible();
  const { count } = await adminClient()
    .from("class_reviews")
    .select("*", { count: "exact", head: true })
    .eq("user_id", m.id)
    .eq("class_id", cls.classId);
  expect(count).toBe(1);
  await expect(page.locator(".class-head").getByText("Reviewed", { exact: true })).toBeVisible();
});

test("hand-in flow", async ({ page, browser }) => {
  const cls = await createClassFixture({ homework: [{ title: "Build a page", handin_expected: true }] });
  const a = await createMember({ name: "Ayesha Handin" });
  const b = await createMember();
  await loginAs(page, a, `/classes/${cls.number}`);
  await page.waitForLoadState("networkidle");
  const hw = page.locator(`#hw-${cls.homeworkIds[0]}`);

  await hw.getByRole("button", { name: "Hand in" }).click();
  await expect(hw.getByText("This homework needs a link to what you made.")).toBeVisible();

  await hw.getByLabel("Link to your work").fill("javascript:alert(1)");
  await hw.getByRole("button", { name: "Hand in" }).click();
  await expect(hw.getByText("Links must start with http:// or https://")).toBeVisible();

  await hw.getByLabel("Link to your work").fill("https://my.site");
  await hw.getByRole("button", { name: "Hand in" }).click();
  await expect(hw.getByText("Handed in")).toBeVisible();
  await expect(hw.getByRole("link", { name: "https://my.site" })).toBeVisible();

  await hw.getByRole("link", { name: "Edit hand-in" }).click();
  await page.waitForLoadState("networkidle");
  await hw.getByLabel("Link to your work").fill("https://my2.site");
  await hw.getByRole("button", { name: "Hand in" }).click();
  await expect(hw.getByRole("link", { name: "https://my2.site" })).toBeVisible();
  const { data } = await adminClient().from("homework_status").select("handin_url").eq("user_id", a.id);
  expect(data).toEqual([{ handin_url: "https://my2.site" }]);

  const ctx = await browser.newContext();
  const pageB = await ctx.newPage();
  await loginAs(pageB, b, `/classes/${cls.number}`);
  const work = pageB.locator(".classmates-work");
  await expect(work.getByText("Ayesha Handin")).toBeVisible();
  await expect(work.getByRole("link", { name: "https://my2.site" })).toBeVisible();
  await ctx.close();
});

test("mark as done without a hand-in, then undo", async ({ page }) => {
  const cls = await createClassFixture({ homework: [{ title: "Read chapter 2", handin_expected: false }] });
  const m = await createMember();
  await loginAs(page, m, `/classes/${cls.number}`);
  await page.waitForLoadState("networkidle");
  const hw = page.locator(`#hw-${cls.homeworkIds[0]}`);
  await hw.getByRole("button", { name: "Mark as done" }).click();
  await expect(hw.getByText("Done ✓")).toBeVisible();
  await hw.getByRole("button", { name: "Undo" }).click();
  await expect(hw.getByRole("button", { name: "Mark as done" })).toBeVisible();
});

test("class guide works on a phone @phone", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/classes/5");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("class question threads opened by the system are signed by the portal, not 'Former member'", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/classes/6");
  const opening = page.locator("article.post").first();
  await expect(opening.getByText("Batch 91 Portal")).toBeVisible();
  await expect(opening.getByText("Former member")).toHaveCount(0);
});
