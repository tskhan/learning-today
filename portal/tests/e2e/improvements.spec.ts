import { expect, test } from "@playwright/test";
import { adminClient, clearFixtureClasses, createClassFixture, createMember, loginAs } from "../helpers/members";

test.beforeEach(async () => {
  await clearFixtureClasses();
});

test("a button that can't do its job says so instead of failing silently", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const cls = await createClassFixture({ status: "draft", title: "Vanishing class" });
  await loginAs(page, admin, "/admin/classes");
  await page.waitForLoadState("networkidle");
  const row = page.locator("tr", { hasText: "Vanishing class" });
  await expect(row).toBeVisible();

  // Someone else deletes the class while this page is open.
  await adminClient().from("classes").delete().eq("id", cls.classId);
  await row.getByRole("button", { name: "Publish" }).click();

  const banner = page.getByRole("alert").filter({ hasText: "That item no longer exists, so nothing was changed." });
  await expect(banner).toBeVisible();
  // The code is cleared from the address, so reloading doesn't show the message again.
  await expect(page).toHaveURL("/admin/classes");
  await page.reload();
  await expect(page.getByText("That item no longer exists")).toHaveCount(0);
});

test("the banner can be dismissed", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/members?error=self");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("You can't change your own role or status. Ask another admin.")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(page.getByText("You can't change your own role or status.")).toHaveCount(0);
});

test("every admin page sends students back to the dashboard on its own", async ({ page }) => {
  const student = await createMember();
  const cls = await createClassFixture();
  await loginAs(page, student);
  for (const path of ["/admin/classes", "/admin/classes/new", `/admin/classes/${cls.classId}`, "/admin/handins", "/admin/members", "/admin/settings"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL("/");
  }
});

test("saving a class with homework still works end to end", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await adminClient().from("classes").delete().eq("number", 8);
  await loginAs(page, admin, "/admin/classes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Class number").fill("8");
  await page.getByLabel("Date").fill("2026-12-06");
  await page.getByLabel("Title").fill("Saved in one go");
  await page.getByRole("button", { name: "Add homework" }).click();
  await page.getByLabel("Homework title").fill("One-go homework");
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page).toHaveURL("/admin/classes");
  const { data } = await adminClient().from("classes").select("id, homework(title)").eq("number", 8).single();
  expect(data?.homework).toEqual([{ title: "One-go homework" }]);
  await adminClient().from("classes").delete().eq("number", 8);
});
