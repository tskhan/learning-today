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
