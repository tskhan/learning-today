import { expect, test, type Page } from "@playwright/test";
import { adminClient, clearFixtureClasses, createClassFixture, createMember, loginAs } from "../helpers/members";

test.beforeEach(async () => {
  await clearFixtureClasses();
  await adminClient().from("classes").delete().gte("number", 7).lt("number", 1000);
  await adminClient().from("settings").update({ join_code: "batch91-change-me" }).eq("id", 1);
});

test.afterAll(async () => {
  await adminClient().from("settings").update({ join_code: "batch91-change-me" }).eq("id", 1);
});

async function createClass7(page: Page) {
  await page.goto("/admin/classes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Class number").fill("7");
  await page.getByLabel("Date").fill("2026-11-29");
  await page.getByLabel("Title").fill("Agents in practice");
  await page.getByLabel("What was discussed").fill("## Topics\n- agents");
  await page.getByRole("button", { name: "Add material" }).click();
  await page.getByLabel("Material label").fill("Slides: agents");
  await page.getByLabel("Material link").fill("https://example.com/slides");
  await page.getByRole("button", { name: "Add homework" }).click();
  await page.getByLabel("Homework title").fill("Build an agent");
  await page.getByLabel("Instructions").fill("Use **Claude Code**.");
  await page.getByLabel("Deadline (Pakistan time)").fill("2026-12-06T23:59");
  await page.getByLabel("Hand-in link expected?").selectOption("yes");
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page).toHaveURL("/admin/classes");
}

test("students cannot open admin", async ({ page }) => {
  const s = await createMember();
  await loginAs(page, s);
  await page.goto("/admin/classes");
  await expect(page).toHaveURL("/");
});

test("create, preview and publish a class with homework", async ({ page, browser }) => {
  const admin = await createMember({ role: "admin" });
  const student = await createMember();
  await loginAs(page, admin);

  await page.goto("/admin/classes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("What was discussed").fill("## Topics\n- agents");
  await page.getByRole("button", { name: "Preview summary" }).click();
  await expect(page.locator(".preview h2", { hasText: "Topics" })).toBeVisible();

  await createClass7(page);
  const row = page.locator("tr", { hasText: "Agents in practice" });
  await expect(row.getByText("Draft")).toBeVisible();

  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  await loginAs(sp, student);
  expect((await sp.goto("/classes/7"))?.status()).toBe(404);

  await row.getByRole("button", { name: "Publish" }).click();
  await expect(page.locator("tr", { hasText: "Agents in practice" }).getByText("Published")).toBeVisible();

  await sp.goto("/classes/7");
  await expect(sp.getByRole("heading", { name: "Agents in practice" })).toBeVisible();
  await expect(sp.getByText("Deadline: 6 Dec 2026, 11:59 pm")).toBeVisible();
  await expect(sp.locator(".prose strong", { hasText: "Claude Code" })).toBeVisible();
  await sp.goto("/discussions");
  await expect(sp.getByRole("link", { name: "Questions about Class 7", exact: true })).toBeVisible();
  await ctx.close();
});

test("a duplicate class number is refused", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/classes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Class number").fill("5");
  await page.getByLabel("Date").fill("2026-11-29");
  await page.getByLabel("Title").fill("Dup");
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page.getByText("Class 5 already exists.")).toBeVisible();
});

test("editing homework keeps hand-ins, and the hand-ins overview shows who did what", async ({ page, browser }) => {
  const admin = await createMember({ role: "admin" });
  const doer = await createMember({ name: `Hina Doer ${Date.now()}` });
  const idle = await createMember({ name: `Imran Idle ${Date.now()}` });
  const cls = await createClassFixture({ title: "Overview class", homework: [{ title: "Original title", handin_expected: true }] });
  await doer.client.from("homework_status").insert({ user_id: doer.id, homework_id: cls.homeworkIds[0], handin_url: "https://hina.dev" });

  await loginAs(page, admin, `/admin/classes`);
  await page.locator("tr", { hasText: "Overview class" }).getByRole("link", { name: "Edit" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Homework title").fill("Renamed title");
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page).toHaveURL("/admin/classes");

  const { data } = await adminClient().from("homework_status").select("handin_url").eq("homework_id", cls.homeworkIds[0]);
  expect(data).toEqual([{ handin_url: "https://hina.dev" }]);

  await page.goto(`/admin/handins?class=${cls.classId}`);
  const table = page.locator("table", { hasText: "Renamed title" });
  await expect(table.locator("tr", { hasText: doer.name }).getByRole("link", { name: "https://hina.dev" })).toBeVisible();
  await expect(table.locator("tr", { hasText: idle.name }).getByText("Not done")).toBeVisible();

  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  await loginAs(sp, doer, `/classes/${cls.number}`);
  await expect(sp.locator(".hw-item").getByRole("heading", { name: "Renamed title" })).toBeVisible();
  await expect(sp.getByText("Handed in")).toBeVisible();
  await ctx.close();
});

test("remove and restore a member", async ({ page, browser }) => {
  const admin = await createMember({ role: "admin" });
  const s = await createMember({ name: "Rafay Removed" });
  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  await loginAs(sp, s);

  await loginAs(page, admin, "/admin/members");
  const row = () => page.locator("tr", { hasText: s.email });
  await row().getByRole("button", { name: "Remove" }).click();
  await expect(row().getByText("removed")).toBeVisible();

  await sp.goto("/");
  await expect(sp).toHaveURL(/\/login\?removed=1/);
  await sp.getByLabel("Email").fill(s.email);
  await sp.getByLabel("Password").fill(s.password);
  await sp.getByRole("button", { name: "Log in" }).click();
  await expect(sp.getByText("This account has been removed.")).toBeVisible();

  await row().getByRole("button", { name: "Restore" }).click();
  await expect(row().getByText("active")).toBeVisible();
  await loginAs(sp, s);
  await expect(sp).toHaveURL("/");
  await ctx.close();
});

test("make admin and back", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const s = await createMember();
  await loginAs(page, admin, "/admin/members");
  const row = () => page.locator("tr", { hasText: s.email });
  await row().getByRole("button", { name: "Make admin" }).click();
  await expect(row().getByRole("button", { name: "Make student" })).toBeVisible();
  await row().getByRole("button", { name: "Make student" }).click();
  await expect(row().getByRole("button", { name: "Make admin" })).toBeVisible();
});

test("reset link works", async ({ page, browser }) => {
  const admin = await createMember({ role: "admin" });
  const s = await createMember();
  await loginAs(page, admin, "/admin/members");
  await page.waitForLoadState("networkidle");
  await page.locator("tr", { hasText: s.email }).getByRole("button", { name: "Reset link" }).click();
  const linkBox = page.getByLabel("Reset link for this member");
  await expect(linkBox).toBeVisible();
  const link = await linkBox.inputValue();
  expect(link).toContain("/auth/confirm?token_hash=");

  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  await sp.goto(link);
  await expect(sp).toHaveURL(/\/reset-password/);
  await sp.waitForLoadState("networkidle");
  await sp.getByLabel("New password", { exact: true }).fill("admin-reset-1");
  await sp.getByLabel("Confirm new password").fill("admin-reset-1");
  await sp.getByRole("button", { name: "Save new password" }).click();
  await expect(sp).toHaveURL("/?reset=1");
  await sp.context().clearCookies();
  await loginAs(sp, { email: s.email, password: "admin-reset-1" });
  await expect(sp).toHaveURL("/");
  await ctx.close();
});

test("delete permanently keeps posts as Former member", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const author = await createMember();
  const s = await createMember({ name: "Daniyal Deleted" });
  const { data: thread } = await author.client.from("threads").insert({ title: `Keep me ${Date.now()}`, body_md: "Q" }).select("id").single();
  await s.client.from("posts").insert({ thread_id: thread!.id, body_md: "Reply that should stay" });

  await loginAs(page, admin, "/admin/members");
  await page.waitForLoadState("networkidle");
  const row = page.locator("tr", { hasText: s.email });
  await row.getByText("Delete permanently").click();
  await row.getByLabel("Type their email to confirm").fill(s.email);
  await row.getByRole("button", { name: "Delete forever" }).click();
  await expect(page.locator("tr", { hasText: s.email })).toHaveCount(0);

  await page.goto(`/discussions/${thread!.id}`);
  const reply = page.locator("article.post", { hasText: "Reply that should stay" });
  await expect(reply.getByText("Former member")).toBeVisible();
});

test("change the join code", async ({ page, browser }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/settings");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Join code").fill("NEWCODE1");
  await page.getByRole("button", { name: "Save join code" }).click();
  await expect(page.getByText("Join code saved.")).toBeVisible();

  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  const signup = async (code: string) => {
    await sp.goto("/signup");
    await sp.waitForLoadState("networkidle");
    await sp.getByLabel("Full name").fill("New Joiner");
    await sp.getByLabel("Email").fill(`join${Date.now()}@test.dev`);
    await sp.getByLabel("Password").fill("password-123");
    await sp.getByLabel("Join code").fill(code);
    await sp.getByRole("button", { name: "Join the batch" }).click();
  };
  await signup("batch91-change-me");
  await expect(sp.getByText("That join code isn't right.")).toBeVisible();
  await signup("newcode1");
  await expect(sp).toHaveURL("/");
  await ctx.close();
});

test("admin cannot remove or demote themselves", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/members");
  const own = page.locator("tr", { hasText: admin.email });
  await expect(own.getByText("You")).toBeVisible();
  await expect(own.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(own.getByRole("button", { name: "Make student" })).toHaveCount(0);
});

test("deleting a class needs its number typed", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const cls = await createClassFixture({ title: "Delete this class" });
  await loginAs(page, admin, `/admin/classes/${cls.classId}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Type the class number to confirm").fill("1");
  await page.getByRole("button", { name: "Delete class" }).click();
  await expect(page.getByText(`Type ${cls.number} to confirm.`)).toBeVisible();
  await page.getByLabel("Type the class number to confirm").fill(String(cls.number));
  await page.getByRole("button", { name: "Delete class" }).click();
  await expect(page).toHaveURL("/admin/classes");
  await expect(page.getByText("Delete this class")).toHaveCount(0);
});
