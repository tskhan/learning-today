import { expect, test } from "@playwright/test";

test("login page shows the logo", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("img", { name: "learning-today.com" })).toBeVisible();
});

test("login page has no horizontal scroll on a phone @phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
