import { expect, test } from "@playwright/test";

test("signed-out visit to / redirects to /login?next=%2F", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
});

test("signed-out visit to /admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});
