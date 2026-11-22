import { expect, test } from "@playwright/test";

test("home shows the portal heading and logo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Batch 91 Portal/i })).toBeVisible();
  await expect(page.getByRole("img", { name: "learning-today.com" })).toBeVisible();
});

test("home has no horizontal scroll on a phone @phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
