import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHABLE_KEY, SECRET_KEY, SUPABASE_URL } from "./env";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SECRET_KEY, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, noSession);
}

let counter = 0;
function unique(): string {
  counter += 1;
  return `${Date.now().toString(36)}${process.pid.toString(36)}${counter}`;
}

export interface TestMember {
  id: string;
  email: string;
  password: string;
  name: string;
  client: SupabaseClient;
}

export async function createMember(opts: {
  role?: "student" | "admin";
  name?: string;
  status?: "active" | "removed";
} = {}): Promise<TestMember> {
  const admin = adminClient();
  const email = `m${unique()}@test.dev`;
  const password = "password-123";
  const name = opts.name ?? `Student ${unique()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const id = data.user.id;
  if (opts.role || opts.status) {
    const patch: Record<string, string> = {};
    if (opts.role) patch.role = opts.role;
    if (opts.status) patch.status = opts.status;
    const { error: e2 } = await admin.from("profiles").update(patch).eq("id", id);
    if (e2) throw e2;
  }
  const client = anonClient();
  const { error: e3 } = await client.auth.signInWithPassword({ email, password });
  if (e3) throw e3;
  return { id, email, password, name, client };
}

let classNumber = 1000 + Math.floor(Math.random() * 100000);

export async function createClassFixture(opts: {
  status?: "draft" | "published";
  title?: string;
  homework?: Array<{ title?: string; deadline?: string | null; handin_expected?: boolean }>;
} = {}): Promise<{ classId: number; number: number; homeworkIds: number[] }> {
  const admin = adminClient();
  classNumber += 1;
  const number = classNumber;
  const { data, error } = await admin
    .from("classes")
    .insert({
      number,
      class_date: "2026-11-29",
      title: opts.title ?? `Fixture class ${number}`,
      summary_md: "Fixture summary.",
      status: opts.status ?? "published",
    })
    .select("id")
    .single();
  if (error) throw error;
  const homeworkIds: number[] = [];
  for (const [i, hw] of (opts.homework ?? []).entries()) {
    const { data: h, error: he } = await admin
      .from("homework")
      .insert({
        class_id: data.id,
        title: hw.title ?? `Homework ${i + 1}`,
        deadline: hw.deadline ?? null,
        handin_expected: hw.handin_expected ?? false,
        position: i,
      })
      .select("id")
      .single();
    if (he) throw he;
    homeworkIds.push(h.id);
  }
  return { classId: data.id, number, homeworkIds };
}

/** Logs a member in through the real login form. */
export async function loginAs(page: import("@playwright/test").Page, member: { email: string; password: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
