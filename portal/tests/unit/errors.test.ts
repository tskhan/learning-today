import { describe, expect, it } from "vitest";
import { friendlyError } from "@/lib/errors";

describe("friendlyError", () => {
  it("explains the rate limit", () => {
    expect(friendlyError({ message: "RATE_LIMIT: too many posts in 10 minutes" })).toBe(
      "You're posting very fast. Please wait a few minutes and try again.",
    );
  });
  it("explains a missing hand-in", () => {
    expect(friendlyError({ message: "HANDIN_REQUIRED: this homework needs a link" })).toBe(
      "This homework needs a link to what you made.",
    );
  });
  it("explains duplicates and permissions", () => {
    expect(friendlyError({ code: "23505" })).toBe("That's already saved.");
    expect(friendlyError({ code: "42501" })).toBe("You don't have permission to do that.");
    expect(friendlyError({ message: "new row violates row-level security policy" })).toBe("You don't have permission to do that.");
  });
  it("falls back to a generic message", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError({ message: "boom" })).toBe("Something went wrong. Please try again.");
  });
});

import { loginErrorMessage } from "@/lib/errors";

describe("loginErrorMessage", () => {
  it("says when the shared login limit is hit instead of blaming the password", () => {
    expect(loginErrorMessage({ status: 429, code: "over_request_rate_limit" })).toBe(
      "Too many log-ins right now. Please wait a few minutes and try again.",
    );
    expect(loginErrorMessage({ status: 429 })).toBe("Too many log-ins right now. Please wait a few minutes and try again.");
  });
  it("explains removed accounts and wrong passwords", () => {
    expect(loginErrorMessage({ code: "user_banned" })).toContain("This account has been removed.");
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("Email or password is wrong.");
  });
});

import { unavailableMessage } from "@/lib/errors";

describe("unavailableMessage", () => {
  it("adds a short reference so the admin can tell what went wrong", () => {
    expect(unavailableMessage({ code: "42501", message: "permission denied for table settings" })).toBe(
      "Sign-up is unavailable right now. Please try again later. (Reference: 42501)",
    );
    expect(unavailableMessage({ message: "Invalid API key" })).toBe(
      "Sign-up is unavailable right now. Please try again later. (Reference: invalid-api-key)",
    );
    expect(unavailableMessage(null)).toBe("Sign-up is unavailable right now. Please try again later. (Reference: no-settings-row)");
  });
  it("says when the secret key itself isn't accepted", () => {
    expect(unavailableMessage({ code: "42501" }, false)).toBe(
      "Sign-up is unavailable right now. Please try again later. (Reference: secret-key-not-accepted)",
    );
    expect(unavailableMessage({ code: "42501" }, true)).toBe(
      "Sign-up is unavailable right now. Please try again later. (Reference: 42501)",
    );
  });
});
