import { expect, it } from "vitest";
import { adminClient, anonClient } from "../helpers/members";

it("public sign-up endpoint is closed", async () => {
  const email = `direct${Date.now()}@test.dev`;
  const { data, error } = await anonClient().auth.signUp({ email, password: "password123" });
  expect(error).not.toBeNull();
  expect(data.user).toBeNull();
  const { data: list } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  expect(list.users.some((u) => u.email === email)).toBe(false);
});
