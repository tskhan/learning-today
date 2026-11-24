import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { adminClient, clearFixtureClasses, createClassFixture, createMember, loginAs } from "../helpers/members";

// A stand-in for Resend's batch endpoint (the dev server is pointed at it in playwright.config.ts).
interface Sent { from: string; to: string[]; subject: string; html: string; text: string }
let server: Server;
let received: Sent[] = [];
let failNext = false;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (failNext) {
        failNext = false;
        res.writeHead(500, { "Content-Type": "application/json" }).end('{"message":"test failure"}');
        return;
      }
      received.push(...(JSON.parse(body) as Sent[]));
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"data":[]}');
    });
  });
  await new Promise<void>((resolve) => server.listen(54399, "127.0.0.1", resolve));
});
test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
test.beforeEach(async () => {
  received = [];
  failNext = false;
  await clearFixtureClasses();
});

const sentTo = (email: string, subjectPart: string) => received.filter((m) => m.to.includes(email) && m.subject.includes(subjectPart));

test("publishing a class emails members once (not the admin, not opted-out or removed members)", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const keen = await createMember();
  const quiet = await createMember();
  const removed = await createMember({ status: "removed" });
  await adminClient().from("profiles").update({ email_new_classes: false }).eq("id", quiet.id);
  const cls = await createClassFixture({ status: "draft", title: `Announced ${Date.now()}`, homework: [{ title: "Try it" }] });

  await loginAs(page, admin, "/admin/classes");
  const row = page.locator("tr", { hasText: cls.number.toString() }).filter({ hasText: "Announced" });
  await expect(row.getByText("When published")).toBeVisible();
  await row.getByRole("button", { name: "Publish" }).click();

  await expect.poll(() => sentTo(keen.email, `Class ${cls.number} guide is up`).length, { timeout: 15_000 }).toBe(1);
  const mail = sentTo(keen.email, `Class ${cls.number}`)[0];
  expect(mail.from).toBe("Batch 91 Portal <no-reply@learning-today.com>");
  expect(mail.to).toEqual([keen.email]);
  expect(mail.text).toContain(`/classes/${cls.number}`);
  expect(mail.text).toContain("- Try it (no deadline)");
  expect(sentTo(quiet.email, `Class ${cls.number}`)).toHaveLength(0);
  expect(sentTo(removed.email, `Class ${cls.number}`)).toHaveLength(0);
  expect(sentTo(admin.email, `Class ${cls.number}`)).toHaveLength(0);

  // The admin page now shows when members were emailed
  await page.reload();
  await expect(row.getByText("When published")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Email members" })).toHaveCount(0);

  // Unpublishing and publishing again doesn't send it twice
  await row.getByRole("button", { name: "Unpublish" }).click();
  await row.getByRole("button", { name: "Publish" }).click();
  await page.waitForTimeout(2000);
  expect(sentTo(keen.email, `Class ${cls.number}`)).toHaveLength(1);
});

test("if sending fails, the admin can email members from Admin → Classes", async ({ page }) => {
  const admin = await createMember({ role: "admin" });
  const keen = await createMember();
  const cls = await createClassFixture({ status: "draft", title: `Retry ${Date.now()}` });
  failNext = true;

  await loginAs(page, admin, "/admin/classes");
  const row = page.locator("tr").filter({ hasText: "Retry" });
  await row.getByRole("button", { name: "Publish" }).click();
  await expect.poll(async () => (await adminClient().from("classes").select("status").eq("id", cls.classId).single()).data?.status).toBe("published");
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(row.getByRole("button", { name: "Email members" })).toBeVisible();
  expect(sentTo(keen.email, `Class ${cls.number}`)).toHaveLength(0);

  await row.getByRole("button", { name: "Email members" }).click();
  await expect(row.getByRole("button", { name: "Email members" })).toHaveCount(0);
  expect(sentTo(keen.email, `Class ${cls.number}`)).toHaveLength(1);
});

test("members can turn class emails off in their profile", async ({ page }) => {
  const m = await createMember();
  await loginAs(page, m, "/profile");
  await page.waitForLoadState("networkidle");
  const box = page.getByLabel("Email me when a new class guide is posted");
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByRole("button", { name: "Save email setting" }).click();
  await expect(page.getByText("Class emails are off.")).toBeVisible();
  const { data } = await adminClient().from("profiles").select("email_new_classes").eq("id", m.id).single();
  expect(data?.email_new_classes).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Email me when a new class guide is posted")).not.toBeChecked();
});

test("a newly published class shows as New until the member reviews it", async ({ page }) => {
  const m = await createMember();
  const cls = await createClassFixture({ status: "published", title: `Fresh ${Date.now()}` });
  await loginAs(page, m);
  const banner = page.locator("a.new-class");
  await expect(banner).toContainText(`Class ${cls.number} guide is up:`);
  await expect(page.locator(".class-list li", { hasText: `Class ${cls.number}` }).getByText("New", { exact: true })).toBeVisible();

  await banner.click();
  await expect(page).toHaveURL(`/classes/${cls.number}`);
  await page.getByRole("button", { name: "I've reviewed this class" }).click();
  await expect(page.getByText("You've reviewed this class")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("a.new-class")).toHaveCount(0);
});
