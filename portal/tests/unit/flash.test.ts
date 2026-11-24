import { describe, expect, it } from "vitest";
import { FLASH_MESSAGES, flashMessage, withError } from "@/lib/flash";

describe("flash error codes", () => {
  it("adds ?error= while keeping the query and the #anchor", () => {
    expect(withError("/admin/classes", "gone")).toBe("/admin/classes?error=gone");
    expect(withError("/classes/5#hw-12", "save_failed")).toBe("/classes/5?error=save_failed#hw-12");
    expect(withError("/admin/handins?class=3", "save_failed")).toBe("/admin/handins?class=3&error=save_failed");
  });
  it("turns codes into messages, and unknown codes into the general one", () => {
    expect(flashMessage("not_yours")).toBe(FLASH_MESSAGES.not_yours);
    expect(flashMessage("something-else")).toBe(FLASH_MESSAGES.save_failed);
    expect(flashMessage(null)).toBeNull();
  });
});
