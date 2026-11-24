import { expect, test } from "@playwright/test";
import { adminClient, createMember, loginAs } from "../helpers/members";

async function startThread(page: import("@playwright/test").Page, title: string, body: string) {
  await page.goto("/discussions/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill(body);
  await page.getByRole("button", { name: "Post discussion" }).click();
  await expect(page).toHaveURL(/\/discussions\/\d+$/);
  return Number(page.url().split("/").pop());
}

test("start a thread and see it listed", async ({ page }) => {
  const a = await createMember();
  await loginAs(page, a);
  const title = `How do I install Claude Code? ${Date.now()}`;
  await startThread(page, title, "I'm stuck on the first step.");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("I'm stuck on the first step.")).toBeVisible();
  await page.goto("/discussions");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("reply and see the reply count", async ({ page, browser }) => {
  const a = await createMember();
  const b = await createMember({ name: "Bilal Reply" });
  await loginAs(page, a);
  const title = `Reply test ${Date.now()}`;
  const id = await startThread(page, title, "Question body");

  const ctx = await browser.newContext();
  const pageB = await ctx.newPage();
  await loginAs(pageB, b, `/discussions/${id}`);
  await pageB.waitForLoadState("networkidle");
  await pageB.getByLabel("Your reply").fill("Here is my answer");
  await pageB.getByRole("button", { name: "Reply" }).click();
  await expect(pageB.getByText("Here is my answer")).toBeVisible();
  await expect(pageB.getByText("Bilal Reply")).toBeVisible();
  await pageB.goto("/discussions");
  await expect(pageB.locator("li", { hasText: title }).getByText("1 reply")).toBeVisible();
  await ctx.close();
});

test("markdown renders and scripts do not", async ({ page }) => {
  const a = await createMember();
  // Saved straight to the database, as an old post or a hand-made request would be.
  const { data: thread } = await a.client
    .from("threads")
    .insert({ title: `Markdown ${Date.now()}`, body_md: "**bold** text\n\n<script>window.__x=1</script>\n\n[link](https://a.dev)" })
    .select("id")
    .single();
  await loginAs(page, a, `/discussions/${thread!.id}`);
  await expect(page.locator(".prose strong", { hasText: "bold" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  await expect(page.locator('.prose a[href="https://a.dev"]')).toHaveAttribute("target", "_blank");
});

test("author can edit and delete own reply; others don't see the controls", async ({ page, browser }) => {
  const a = await createMember();
  const b = await createMember();
  await loginAs(page, a);
  const id = await startThread(page, `Edit test ${Date.now()}`, "Opening post");
  await page.getByLabel("Your reply").fill("First version");
  await page.getByRole("button", { name: "Reply" }).click();
  const reply = page.locator("article.post", { hasText: "First version" });
  await expect(reply).toBeVisible();

  const ctx = await browser.newContext();
  const pageB = await ctx.newPage();
  await loginAs(pageB, b, `/discussions/${id}`);
  await expect(pageB.locator("article.post", { hasText: "First version" }).getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(pageB.locator("article.post", { hasText: "First version" }).getByRole("button", { name: "Delete" })).toHaveCount(0);
  await ctx.close();

  await reply.getByRole("link", { name: "Edit" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Edit your reply").fill("Second version");
  await page.getByRole("button", { name: "Save" }).click();
  const edited = page.locator("article.post", { hasText: "Second version" });
  await expect(edited).toBeVisible();
  await expect(edited.getByText("(edited)")).toBeVisible();

  await edited.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Second version")).toHaveCount(0);
});

test("admin can pin and delete any thread", async ({ page, browser }) => {
  const a = await createMember();
  const admin = await createMember({ role: "admin" });
  await loginAs(page, a);
  const title = `Pin me ${Date.now()}`;
  const id = await startThread(page, title, "Body");
  const title2 = `Delete me ${Date.now()}`;
  const id2 = await startThread(page, title2, "Body");

  const ctx = await browser.newContext();
  const pageAdmin = await ctx.newPage();
  await loginAs(pageAdmin, admin, `/discussions/${id}`);
  await pageAdmin.waitForLoadState("networkidle");
  await pageAdmin.getByRole("button", { name: "Pin to top" }).click();
  await expect(pageAdmin.getByRole("button", { name: "Unpin" })).toBeVisible();
  await pageAdmin.goto("/discussions");
  const first = pageAdmin.locator("ul.threads > li").first();
  await expect(first).toContainText(title);
  await expect(first.getByText("Pinned")).toBeVisible();
  // unpin so later runs aren't affected
  await pageAdmin.goto(`/discussions/${id}`);
  await pageAdmin.waitForLoadState("networkidle");
  await pageAdmin.getByRole("button", { name: "Unpin" }).click();
  await expect(pageAdmin.getByRole("button", { name: "Pin to top" })).toBeVisible();

  await pageAdmin.goto(`/discussions/${id2}`);
  await pageAdmin.waitForLoadState("networkidle");
  await pageAdmin.locator("article.post").first().getByRole("button", { name: "Delete" }).click();
  await pageAdmin.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(pageAdmin).toHaveURL("/discussions");
  await expect(pageAdmin.getByRole("link", { name: title2 })).toHaveCount(0);
  await ctx.close();
});

test("rate limit message", async ({ page }) => {
  const a = await createMember();
  const { data: thread } = await a.client.from("threads").insert({ title: "Busy", body_md: "B" }).select("id").single();
  for (let i = 0; i < 9; i++) await a.client.from("posts").insert({ thread_id: thread!.id, body_md: `r${i}` });
  await loginAs(page, a, `/discussions/${thread!.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your reply").fill("one more");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("You're posting very fast.")).toBeVisible();
});

test("class threads from the seed are listed", async ({ page }) => {
  const a = await createMember();
  await loginAs(page, a, "/discussions");
  const row = page.locator("ul.threads > li", { hasText: "Questions about Class 6" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Class 6", { exact: true })).toBeVisible();
});

test("too-long title is refused", async ({ page }) => {
  const a = await createMember();
  await loginAs(page, a, "/discussions/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
  await page.getByLabel("Title").fill("x".repeat(151));
  await page.getByLabel("Message").fill("Body");
  await page.getByRole("button", { name: "Post discussion" }).click();
  await expect(page.getByText("Titles can be up to 150 characters.")).toBeVisible();
});

test("a thread can be linked to a class", async ({ page }) => {
  const a = await createMember();
  await loginAs(page, a, "/discussions/new");
  await page.waitForLoadState("networkidle");
  const title = `About class 5 ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill("Body");
  await page.getByLabel("About a class (optional)").selectOption({ label: "Class 5: Chapter 1 and coding agents" });
  await page.getByRole("button", { name: "Post discussion" }).click();
  await expect(page).toHaveURL(/\/discussions\/\d+$/);
  const { data } = await adminClient().from("threads").select("class_id, classes(number)").eq("title", title).single();
  expect((data as unknown as { classes: { number: number } }).classes.number).toBe(5);
});
