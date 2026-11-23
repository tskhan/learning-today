import { expect, test } from "@playwright/test";
import { adminClient, clearSignupAttempts, createMember, loginAs } from "../helpers/members";
import { latestLinkTo } from "../helpers/mailpit";

test.beforeEach(async () => {
  await clearSignupAttempts();
});

function uniqueEmail() {
  return `e2e${Date.now()}${Math.floor(Math.random() * 1000)}@test.dev`;
}

async function fillSignup(page: import("@playwright/test").Page, email: string, code: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Bilal Ahmed");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123");
  await page.getByLabel("Join code").fill(code);
  await page.getByRole("button", { name: "Join the batch" }).click();
}

async function userExists(email: string) {
  const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  return data.users.some((u) => u.email === email);
}

test("wrong join code is refused", async ({ page }) => {
  const email = uniqueEmail();
  await fillSignup(page, email, "nope");
  await expect(page.getByText("That join code isn't right.")).toBeVisible();
  expect(await userExists(email)).toBe(false);
});

test("right join code signs up and lands on the dashboard", async ({ page }) => {
  const email = uniqueEmail();
  await fillSignup(page, email, "BATCH91-CHANGE-ME");
  await expect(page).toHaveURL("/");
  const nav = page.getByRole("navigation", { name: "Portal" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Classes" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Discussions" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("an email that already has an account is refused", async ({ page }) => {
  const m = await createMember();
  await fillSignup(page, m.email, "batch91-change-me");
  await expect(page.getByText("There's already an account with that email.")).toBeVisible();
});

test("log out and log back in", async ({ page }) => {
  const m = await createMember({ name: "Sana Malik" });
  await loginAs(page, m);
  await expect(page).toHaveURL("/");
  await page.getByText("Sana").first().click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, m);
  await expect(page).toHaveURL("/");
});

test("wrong password shows a clear error", async ({ page }) => {
  const m = await createMember();
  await page.goto("/login");
  await page.getByLabel("Email").fill(m.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong.")).toBeVisible();
});

test("next param is honoured but never sends you off-site", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/classes");
  await expect(page).toHaveURL("/classes");
  await page.context().clearCookies();
  await loginAs(page, m, "https://evil.dev");
  await expect(page).toHaveURL("/");
  await page.context().clearCookies();
  await loginAs(page, m, "//evil.dev");
  await expect(page).toHaveURL("/");
});

test("password reset by email", async ({ page }) => {
  const m = await createMember();
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(m.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has an account, a reset link is on its way.")).toBeVisible();

  const link = await latestLinkTo(m.email, "/auth/confirm");
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByLabel("New password", { exact: true }).fill("brand-new-pass");
  await page.getByLabel("Confirm new password").fill("brand-new-pass");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/?reset=1");
  await expect(page.getByText("Your password has been changed.")).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, { email: m.email, password: "brand-new-pass" });
  await expect(page).toHaveURL("/");
});

test("an old or used reset link explains what to do", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=recovery&next=/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?expired=1/);
  await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
});

test("removed member is locked out", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m);
  await adminClient().from("profiles").update({ status: "removed" }).eq("id", m.id);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?removed=1/);
  await expect(page.getByText("This account has been removed.")).toBeVisible();

  await page.getByLabel("Email").fill(m.email);
  await page.getByLabel("Password").fill(m.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("This account has been removed.")).toBeVisible();
  await page.goto("/classes");
  await expect(page).toHaveURL(/\/login/);
});

test("admin sees the Admin link", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin);
  await expect(page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Admin" })).toBeVisible();
});
