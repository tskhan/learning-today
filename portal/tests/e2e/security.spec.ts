import { expect, test } from "@playwright/test";
import { adminClient, clearFixtureClasses, clearSignupAttempts, createClassFixture, createMember, loginAs } from "../helpers/members";
import { JOIN_CODE_LIMIT } from "../../lib/signup-throttle";

test.beforeEach(async () => {
  await clearSignupAttempts();
});
test.afterEach(async () => {
  await clearSignupAttempts();
});

test("every page refuses to be framed by another site", async ({ request }) => {
  for (const path of ["/login", "/signup"]) {
    const res = await request.get(path);
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  }
});

test("guessing join codes is stopped after the limit, even with the right code", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `guess${Date.now()}@test.dev`;
  const tryCode = async (code: string) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Full name").fill("Guesser");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-123");
    await page.getByLabel("Join code").fill(code);
    await page.getByRole("button", { name: "Join the batch" }).click();
  };
  for (let i = 0; i < JOIN_CODE_LIMIT.attempts; i++) {
    await tryCode(`wrong-${i}`);
    await expect(page.getByText("That join code isn't right.")).toBeVisible();
  }
  await tryCode("batch91-change-me");
  await expect(page.getByText("Too many wrong join codes from your network.")).toBeVisible();
  const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(false);
});

test("a join code shorter than 10 characters is refused", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/settings");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Join code").fill("short1");
  await page.getByRole("button", { name: "Save join code" }).click();
  await expect(page.getByText("Use 10–64 characters with no spaces.")).toBeVisible();
  const { data } = await adminClient().from("settings").select("join_code").single();
  expect(data?.join_code).toBe("batch91-change-me");
});

test("a hand-in note is shown to its author only, and can be changed", async ({ page, browser }) => {
  await clearFixtureClasses();
  const cls = await createClassFixture({ homework: [{ title: "Private note task", handin_expected: true }] });
  const author = await createMember();
  await loginAs(page, author, `/classes/${cls.number}`);
  await page.waitForLoadState("networkidle");
  const hw = page.locator(`#hw-${cls.homeworkIds[0]}`);
  await expect(hw.getByText("Only you can see your note.")).toBeVisible();
  await hw.getByLabel("Link to your work").fill("https://my-work.example.com");
  await hw.getByLabel("Note (optional)").fill("note for me");
  await hw.getByRole("button", { name: /hand in|mark as done|save/i }).click();
  await expect(hw.getByText("note for me")).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  const classmate = await createMember();
  await loginAs(other, classmate, `/classes/${cls.number}`);
  await expect(other.getByRole("link", { name: "https://my-work.example.com" })).toBeVisible();
  await expect(other.getByText("note for me")).toHaveCount(0);
  await ctx.close();
});
