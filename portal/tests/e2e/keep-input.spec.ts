import { expect, test } from "@playwright/test";
import { adminClient, clearFixtureClasses, clearSignupAttempts, createClassFixture, createMember, loginAs } from "../helpers/members";

test.beforeEach(async () => {
  await clearSignupAttempts();
});

test("a wrong join code keeps name, email and code (password is cleared)", async ({ page }) => {
  await page.goto("/signup");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Full name").fill("Kept Name");
  await page.getByLabel("Email").fill("kept@test.dev");
  await page.getByLabel("Password").fill("password-123");
  await page.getByLabel("Join code").fill("wrong-code");
  await page.getByRole("button", { name: "Join the batch" }).click();
  await expect(page.getByText("That join code isn't right.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Kept Name");
  await expect(page.getByLabel("Email")).toHaveValue("kept@test.dev");
  await expect(page.getByLabel("Join code")).toHaveValue("wrong-code");
});

test("a wrong password keeps the email", async ({ page }) => {
  const m = await createMember();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(m.email);
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(m.email);
});

test("a refused reply keeps what was typed", async ({ page }) => {
  const a = await createMember();
  const { data: thread } = await a.client.from("threads").insert({ title: "Busy", body_md: "B" }).select("id").single();
  for (let i = 0; i < 9; i++) await a.client.from("posts").insert({ thread_id: thread!.id, body_md: `r${i}` });
  await loginAs(page, a, `/discussions/${thread!.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your reply").fill("A long, careful answer I don't want to lose");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("You're posting very fast.")).toBeVisible();
  await expect(page.getByLabel("Your reply")).toHaveValue("A long, careful answer I don't want to lose");
});

test("a refused new discussion keeps title, message and class", async ({ page }) => {
  const a = await createMember();
  await loginAs(page, a, "/discussions/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
  await page.getByLabel("Title").fill("x".repeat(151));
  await page.getByLabel("Message").fill("My message body");
  await page.getByLabel("About a class (optional)").selectOption({ label: "Class 5: Chapter 1 and coding agents" });
  await page.getByRole("button", { name: "Post discussion" }).click();
  await expect(page.getByText("Titles can be up to 150 characters.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("x".repeat(151));
  await expect(page.getByLabel("Message")).toHaveValue("My message body");
  await expect(page.getByLabel("About a class (optional)").locator("option:checked")).toHaveText("Class 5: Chapter 1 and coding agents");
});

test("a refused edit keeps the edited text", async ({ page }) => {
  const a = await createMember();
  const { data: thread } = await a.client.from("threads").insert({ title: "Editable", body_md: "Original" }).select("id").single();
  const { data: post } = await a.client.from("posts").insert({ thread_id: thread!.id, body_md: "Reply original" }).select("id").single();
  await loginAs(page, a, `/discussions/${thread!.id}?edit=post-${post!.id}`);
  await page.waitForLoadState("networkidle");
  const box = page.getByLabel("Edit your reply");
  await box.evaluate((el: HTMLTextAreaElement) => el.removeAttribute("maxlength"));
  const long = "y".repeat(5001);
  await box.fill(long);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Messages can be up to 5,000 characters.")).toBeVisible();
  await expect(box).toHaveValue(long);
});

test("a refused hand-in keeps the typed link and note", async ({ page }) => {
  const cls = await createClassFixture({ homework: [{ handin_expected: true }] });
  const m = await createMember();
  await loginAs(page, m, `/classes/${cls.number}`);
  await page.waitForLoadState("networkidle");
  const hw = page.locator(`#hw-${cls.homeworkIds[0]}`);
  await hw.getByLabel("Link to your work").fill("javascript:alert(1)");
  await hw.getByLabel("Note (optional)").fill("my note");
  await hw.getByRole("button", { name: "Hand in" }).click();
  await expect(hw.getByText("Links must start with http:// or https://")).toBeVisible();
  await expect(hw.getByLabel("Link to your work")).toHaveValue("javascript:alert(1)");
  await expect(hw.getByLabel("Note (optional)")).toHaveValue("my note");
});

test("a refused class save keeps every field, materials and homework included", async ({ page }) => {
  await clearFixtureClasses();
  await adminClient().from("classes").delete().gte("number", 7).lt("number", 1000);
  const admin = await createMember({ role: "admin" });
  await loginAs(page, admin, "/admin/classes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Class number").fill("5");
  await page.getByLabel("Date").fill("2026-11-29");
  await page.getByLabel("Title").fill("Kept title");
  await page.getByRole("button", { name: "Add material" }).click();
  await page.getByLabel("Material label").fill("Kept material");
  await page.getByLabel("Material link").fill("https://kept.dev");
  await page.getByRole("button", { name: "Add homework" }).click();
  await page.getByLabel("Homework title").fill("Kept homework");
  await page.getByLabel("Deadline (Pakistan time)").fill("2026-12-06T23:59");
  await page.getByLabel("Hand-in link expected?").selectOption("yes");
  await page.getByRole("button", { name: "Save class" }).click();
  await expect(page.getByText("Class 5 already exists.")).toBeVisible();
  await expect(page.getByLabel("Class number")).toHaveValue("5");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Kept title");
  await expect(page.getByLabel("Material label")).toHaveValue("Kept material");
  await expect(page.getByLabel("Material link")).toHaveValue("https://kept.dev");
  await expect(page.getByLabel("Homework title")).toHaveValue("Kept homework");
  await expect(page.getByLabel("Deadline (Pakistan time)")).toHaveValue("2026-12-06T23:59");
  await expect(page.getByLabel("Hand-in link expected?")).toHaveValue("yes");
});
