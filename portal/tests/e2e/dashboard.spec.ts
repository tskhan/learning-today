import { expect, test } from "@playwright/test";
import { clearFixtureClasses, createClassFixture, createMember, loginAs, setJoinedAt } from "../helpers/members";

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

test.beforeEach(async () => {
  await clearFixtureClasses();
});

test("summary line, due and overdue", async ({ page }) => {
  const cls = await createClassFixture({
    homework: [
      { title: "Future task", deadline: iso(2) },
      { title: "Late task", deadline: iso(-1) },
    ],
  });
  const m = await createMember();
  await setJoinedAt(m.id, iso(-7));
  await loginAs(page, m);
  await expect(page.getByText("0 of 7 classes reviewed · 1 homework due · 1 overdue")).toBeVisible();
  await expect(page.locator(".overdue-list").getByText("Late task")).toBeVisible();
  await expect(page.locator(".due-list").getByText("Future task")).toBeVisible();

  for (const id of cls.homeworkIds) {
    await m.client.from("homework_status").insert({ user_id: m.id, homework_id: id });
  }
  await page.reload();
  await expect(page.getByText("You're all caught up.")).toBeVisible();
  await expect(page.locator(".overdue-list")).toHaveCount(0);
});

test("late joiner sees catch-up, not overdue", async ({ page }) => {
  await createClassFixture({ homework: [{ title: "Old task", deadline: iso(-10) }] });
  const m = await createMember();
  await setJoinedAt(m.id, iso(-1));
  await loginAs(page, m);
  await expect(page.locator(".catchup-list").getByText("Old task")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue" })).toHaveCount(0);
});

test("profile name change shows in the greeting", async ({ page }) => {
  const m = await createMember({ name: "Old Name" });
  await loginAs(page, m, "/profile");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(m.email)).toBeVisible();
  await page.getByLabel("Full name").fill("Zara Updated");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Name saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome, Zara" })).toBeVisible();
});

test("a new member is welcomed; someone who joined earlier is welcomed back", async ({ page }) => {
  const fresh = await createMember({ name: "Nida New" });
  await loginAs(page, fresh);
  await expect(page.getByRole("heading", { name: "Welcome, Nida", exact: true })).toBeVisible();

  const returning = await createMember({ name: "Omar Old" });
  await setJoinedAt(returning.id, iso(-3));
  await page.context().clearCookies();
  await loginAs(page, returning);
  await expect(page.getByRole("heading", { name: "Welcome back, Omar", exact: true })).toBeVisible();
});

test("dashboard works on a phone @phone", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("every nav link fits on a phone, including Admin @phone", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin);
  const vw = page.viewportSize()!.width;
  for (const name of ["Dashboard", "Classes", "Discussions", "Admin"]) {
    const box = await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  }
  const menu = await page.locator(".user-menu summary").boundingBox();
  const adminLink = await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Admin" }).boundingBox();
  const overlaps = menu!.y < adminLink!.y + adminLink!.height && adminLink!.y < menu!.y + menu!.height &&
    menu!.x < adminLink!.x + adminLink!.width && adminLink!.x < menu!.x + menu!.width;
  expect(overlaps).toBe(false);
});
